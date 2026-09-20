import browser from 'webextension-polyfill'
import type { Command, SearchSession, Snapshot } from '../shared/types'
import { createSession } from '../shared/search'
import { GitsError } from '../shared/errors'
import {
  JevDecisionEngine,
  MockDecisionEngine,
  testJevConnection,
} from './decision-engine'
import { MapsClient } from './maps-client'
import { researchStep } from './research-runner'
import {
  assertSessionRunning,
  readKey,
  readSession,
  saveRunningSession,
  saveSession,
  snapshot,
  storageKeys,
} from './storage'

const alarmName = 'gits-research'
const stateLock = 'gits-session-state'
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function cancelMaps(session: SearchSession | null) {
  if (session?.tabId === undefined)
    return
  try {
    await browser.tabs.sendMessage(session.tabId, {
      channel: 'gits-maps',
      cancel: true,
    })
  }
  catch (error) {
    console.error(`[Cancel Maps Error]:: ${error}`)
  }
}

async function ensureTab(session: SearchSession): Promise<number> {
  if (session.tabId !== undefined) {
    try {
      const tab = await browser.tabs.get(session.tabId)
      if (tab.url?.startsWith('https://www.google.com/maps'))
        return session.tabId
    }
    catch (error) {
      console.error(`[Ensure Tabs Error]:: ${error}`)
    }
  }
  const tab = await browser.tabs.create({
    url: 'https://www.google.com/maps?hl=en',
    active: true,
  })
  if (tab.id === undefined)
    throw new GitsError('maps_connection', 'Could not open a Google Maps tab.')
  session.tabId = tab.id
  session.phase = 'searching'
  return tab.id
}

export async function handleCommand(command: Command): Promise<Snapshot> {
  if (
    ![
      'snapshot',
      'connect',
      'remove-key',
      'settings',
      'start',
      'pause',
      'resume',
      'stop',
      'new-search',
    ].includes(command.type)
  ) {
    throw new GitsError('invalid_command', 'Unsupported research command.')
  }
  if (command.type === 'snapshot')
    return snapshot()
  // Serialize UI commands, including key replacement, across popup/options windows.
  await navigator.locks.request('gits-commands', async () => {
    if (command.type === 'connect') {
      const session = await readSession()
      if (session?.status === 'running') {
        throw new GitsError(
          'busy',
          'Pause research before changing or testing the key.',
        )
      }
      const key = command.key?.trim() || (await readKey())
      if (!key || key.length > 512)
        throw new GitsError('invalid_key', 'Enter a valid Jev API key.')
      try {
        await testJevConnection(key)
      }
      catch (error) {
        if (!command.key) {
          await browser.storage.local.set({
            [storageKeys.connection]: { hasKey: true, connected: false },
          })
        }
        throw error
      }
      await browser.storage.local.set({
        [storageKeys.key]: key,
        [storageKeys.connection]: { hasKey: true, connected: true },
      })
      return
    }
    await navigator.locks.request(stateLock, async () => {
      const session = await readSession()
      if (command.type === 'settings') {
        const s = command.settings
        if (
          !s
          || !['jev', 'mock'].includes(s.engine)
          || !['light', 'dark', 'system'].includes(s.theme)
          || !Number.isInteger(s.decisionLimit)
          || s.decisionLimit < 1
          || s.decisionLimit > 1000
        ) {
          throw new GitsError(
            'invalid_config',
            'Decision limit must be between 1 and 1000.',
          )
        }
        await browser.storage.local.set({
          [storageKeys.settings]: {
            engine: s.engine,
            theme: s.theme,
            decisionLimit: s.decisionLimit,
          },
        })
        return
      }
      if (command.type === 'remove-key') {
        if (session?.status === 'running') {
          session.controlVersion++
          session.status = 'paused'
          session.message = 'Jev key removed. Add a key before resuming.'
          await saveSession(session)
        }
        await cancelMaps(session)
        await browser.storage.local.remove(storageKeys.key)
        await browser.storage.local.set({
          [storageKeys.connection]: { hasKey: false, connected: false },
        })
        return
      }
      if (command.type === 'start') {
        if (session) {
          throw new GitsError(
            'session_exists',
            'Use New Search after reviewing or exporting the current results.',
          )
        }
        const next = createSession(command.config)
        if (
          next.engine === 'jev'
          && (!(await readKey()) || !(await snapshot()).connection.connected)
        ) {
          throw new GitsError(
            'invalid_key',
            'Connect and test Jev in settings first.',
          )
        }
        await ensureTab(next)
        await saveSession(next)
        return
      }
      if (!session)
        throw new GitsError('no_session', 'No active research session.')
      if (command.type === 'new-search') {
        if (session.status === 'running')
          throw new GitsError('busy', 'Stop the current research first.')
        await cancelMaps(session)
        await saveSession(null)
        return
      }
      if (command.type === 'pause' || command.type === 'stop') {
        if (command.type === 'pause' && session.status !== 'running')
          return
        session.status = command.type === 'pause' ? 'paused' : 'stopped'
        session.controlVersion++
        session.message
          = command.type === 'pause'
            ? 'Research paused. Saved progress is preserved.'
            : 'Research stopped by you. Saved leads are ready to export.'
        session.updatedAt = Date.now()
        await saveSession(session)
        await cancelMaps(session)
        return
      }
      if (command.type === 'resume') {
        if (!['paused', 'error'].includes(session.status)) {
          throw new GitsError(
            'session_finished',
            'Start a new search to continue from a finished session.',
          )
        }
        if (session.engine === 'jev' && !(await readKey()))
          throw new GitsError('invalid_key', 'Connect Jev first.')
        await ensureTab(session)
        // Reload the result list after a DOM interruption; keep a fully read candidate for evaluation.
        if (session.phase !== 'evaluating')
          session.phase = 'searching'
        session.status = 'running'
        session.errorCode = undefined
        session.message = 'Resuming research…'
        session.controlVersion++
        session.updatedAt = Date.now()
        await saveSession(session)
      }
    })
  })
  const data = await snapshot()
  if (data.session?.status === 'running') {
    browser.alarms.create(alarmName, { periodInMinutes: 0.5 })
    void pumpResearch()
  }
  else {
    await browser.alarms.clear(alarmName)
  }
  return data
}

export async function pumpResearch(): Promise<void> {
  try {
    await navigator.locks.request(
      'gits-runner',
      { ifAvailable: true },
      async (lock) => {
        if (!lock)
          return
        for (;;) {
          const session = await readSession()
          if (!session || session.status !== 'running')
            return
          const checkpoint = () => assertSessionRunning(session)
          const persist = saveRunningSession
          if (session.tabId === undefined) {
            session.status = 'error'
            session.errorCode = 'maps_connection'
            session.message
              = 'Research tab is unavailable. Resume to open Google Maps again.'
            await persist(session)
            return
          }
          try {
            const tab = await browser.tabs.get(session.tabId)
            if (tab.url?.startsWith('https://consent.google.com/')) {
              session.status = 'error'
              session.errorCode = 'maps_consent'
              session.message
                = 'Complete Google’s consent screen manually, then resume.'
              await persist(session)
              return
            }
            if (tab.status === 'loading') {
              if (Date.now() - session.updatedAt > 45000) {
                session.status = 'error'
                session.errorCode = 'maps_loading'
                session.message
                  = 'Google Maps took too long to load. Check the tab and resume.'
                await persist(session)
                return
              }
              await delay(1000)
              continue
            }
          }
          catch {
            session.status = 'error'
            session.errorCode = 'maps_connection'
            session.message
              = 'Research tab was closed. Resume to open Google Maps again.'
            await persist(session)
            return
          }
          const key = session.engine === 'jev' ? await readKey() : undefined
          if (session.engine === 'jev' && !key) {
            session.status = 'paused'
            session.errorCode = 'invalid_key'
            session.message = 'Connect Jev in settings before resuming.'
            await persist(session)
            return
          }
          await researchStep(session, {
            maps: new MapsClient(session.tabId, checkpoint),
            engine:
              session.engine === 'mock'
                ? new MockDecisionEngine()
                : new JevDecisionEngine(key!),
            persist,
            checkpoint,
          })
          if (session.errorCode === 'invalid_key') {
            await browser.storage.local.set({
              [storageKeys.connection]: { hasKey: true, connected: false },
            })
          }
          if (session.status !== 'running') {
            await browser.alarms.clear(alarmName)
            return
          }
          await delay(1000)
        }
      },
    )
  }
  catch (error) {
    console.error(`[Pump Research Error]:: ${error}`)
  }
}

export function onResearchAlarm(name: string) {
  if (name === alarmName)
    void pumpResearch()
}

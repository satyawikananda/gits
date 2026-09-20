import browser from 'webextension-polyfill'
import { GitsError } from '../shared/errors'
import type {
  Connection,
  SearchSession,
  Settings,
  Snapshot,
} from '../shared/types'

export const storageKeys = {
  session: 'gits.session.v1',
  settings: 'gits.settings.v1',
  key: 'gits.jevKey',
  connection: 'gits.connection',
}

export const defaultSettings: Settings = {
  engine: 'jev',
  decisionLimit: 100,
  theme: 'system',
}

export async function readSession(): Promise<SearchSession | null> {
  const data = await browser.storage.local.get(storageKeys.session)
  return (data[storageKeys.session] as SearchSession | undefined) ?? null
}

export async function saveSession(
  session: SearchSession | null,
): Promise<void> {
  await browser.storage.local.set({ [storageKeys.session]: session })
}

export async function assertSessionRunning(
  session: SearchSession,
): Promise<void> {
  const current = await readSession()
  if (
    current?.id !== session.id
    || current.status !== 'running'
    || current.controlVersion !== session.controlVersion
  ) {
    throw new GitsError('interrupted', 'Session interrupted.')
  }
}

export async function saveRunningSession(
  session: SearchSession,
): Promise<void> {
  await navigator.locks.request('gits-session-state', async () => {
    await assertSessionRunning(session)
    await saveSession(session)
  })
}

export async function readKey(): Promise<string | undefined> {
  const data = await browser.storage.local.get(storageKeys.key)
  return typeof data[storageKeys.key] === 'string'
    ? (data[storageKeys.key] as string)
    : undefined
}

export async function snapshot(): Promise<Snapshot> {
  const data = await browser.storage.local.get([
    storageKeys.session,
    storageKeys.settings,
    storageKeys.connection,
  ])
  return {
    session: (data[storageKeys.session] as SearchSession | undefined) ?? null,
    settings:
      (data[storageKeys.settings] as Settings | undefined) ?? defaultSettings,
    connection: (data[storageKeys.connection] as Connection | undefined) ?? {
      hasKey: false,
      connected: false,
    },
  }
}

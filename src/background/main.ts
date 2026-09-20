import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'
import type { Command, Reply, Snapshot } from '../shared/types'
import { safeError } from '../shared/errors'
import { restrictLocalStorage } from './privacy'
import { handleCommand, onResearchAlarm, pumpResearch } from './controller'

if (import.meta.hot) {
  // @ts-expect-error Vite development runtime
  import('/@vite/client')
}

async function protectedCommand(command: Command) {
  await restrictLocalStorage()
  return handleCommand(command)
}

async function respond(command: Command): Promise<Reply<Snapshot>> {
  try {
    return { ok: true, data: await protectedCommand(command) }
  }
  catch (error) {
    return { ok: false, error: safeError(error).message }
  }
}

browser.runtime.onMessage.addListener(
  (raw: unknown, sender: Runtime.MessageSender) => {
    if (!raw || typeof raw !== 'object')
      return undefined
    const message = raw as { channel?: string, command?: Command }

    // A content script must never be able to read or replace a key or start research.
    if (
      sender.id !== browser.runtime.id
      || !['dist/popup/index.html', 'dist/options/index.html'].some(
        path => sender.url?.split(/[?#]/)[0] === browser.runtime.getURL(path),
      )
    ) {
      return undefined
    }
    if (
      message?.channel !== 'gits-ui'
      || !message.command
      || typeof message.command.type !== 'string'
    ) {
      return undefined
    }
    return respond(message.command)
  },
)
browser.alarms.onAlarm.addListener(alarm => onResearchAlarm(alarm.name))
browser.runtime.onStartup.addListener(() => {
  void pumpResearch()
})
browser.runtime.onInstalled.addListener(() => {
  void pumpResearch()
})

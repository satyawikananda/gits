import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'
import type { MapsCommand, Reply } from '../shared/types'
import { safeError } from '../shared/errors'
import { GoogleMapsExecutor } from './google-maps/executor'

let activeOperation: AbortController | undefined
browser.runtime.onMessage.addListener(
  (raw: unknown, sender: Runtime.MessageSender) => {
    if (!raw || typeof raw !== 'object')
      return undefined
    const message = raw as {
      channel?: string
      ping?: boolean
      cancel?: boolean
      command?: MapsCommand
    }

    if (sender.id !== browser.runtime.id || message?.channel !== 'gits-maps')
      return undefined
    if (message.ping)
      return Promise.resolve({ ok: true, data: { ready: true } })
    if (message.cancel) {
      activeOperation?.abort()
      return Promise.resolve({ ok: true, data: null })
    }
    return message.command ? execute(message.command) : undefined
  },
)
async function execute(
  command: MapsCommand,
): Promise<Reply<unknown> & { code?: string }> {
  if (activeOperation) {
    return {
      ok: false,
      error: 'Google Maps is still processing the previous operation.',
      code: 'maps_busy',
    }
  }
  activeOperation = new AbortController()
  const maps = new GoogleMapsExecutor(activeOperation.signal)
  try {
    let data: unknown
    switch (command.operation) {
      case 'search':
        data = await maps.search(command.query)
        break
      case 'scrollResults':
        data = await maps.scrollResults()
        break
      case 'openBusiness':
        data = await maps.openBusiness(command.candidate)
        break
      case 'readBusiness':
        data = await maps.readBusiness(command.candidate, command.query)
        break
      case 'backToResults':
        data = await maps.backToResults()
        break
      default:
        return {
          ok: false,
          error: 'Unknown Maps operation.',
          code: 'maps_unsupported',
        }
    }
    return { ok: true, data: data ?? null }
  }
  catch (error) {
    const safe = safeError(error)
    return { ok: false, error: safe.message, code: safe.code }
  }
  finally {
    activeOperation = undefined
  }
}

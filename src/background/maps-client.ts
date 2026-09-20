import browser from 'webextension-polyfill'
import type {
  CandidateRef,
  LeadCandidate,
  MapsCommand,
  MapsExecutor,
  Reply,
} from '../shared/types'
import { GitsError } from '../shared/errors'

export class MapsClient implements MapsExecutor {
  constructor(
    private readonly tabId: number,
    private readonly checkpoint: () => Promise<void> = async () => {},
  ) {}

  private async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      await this.checkpoint()
      let ready = false
      try {
        const reply: Reply<{ ready: boolean }> | undefined
          = await browser.tabs.sendMessage(
            this.tabId,
            { channel: 'gits-maps', ping: true },
            { frameId: 0 },
          )
        ready = reply?.ok === true && reply.data?.ready === true
      }
      catch (error) {
        console.error(error)
      }
      if (ready) {
        await this.checkpoint()
        return
      }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    await this.checkpoint()
    throw new GitsError(
      'maps_connection',
      'Gits could not connect to the Google Maps tab. Reload that tab, allow Gits access to www.google.com in extension settings, then resume.',
    )
  }

  private async command<T>(command: MapsCommand): Promise<T> {
    await this.waitUntilReady()
    let reply: Reply<T> & { code?: string }
    try {
      reply = await browser.tabs.sendMessage(
        this.tabId,
        { channel: 'gits-maps', command },
        { frameId: 0 },
      )
    }
    catch {
      throw new GitsError(
        'maps_connection',
        `Google Maps disconnected during ${command.operation}. Keep the research tab open, reload it, then resume.`,
      )
    }
    if (!reply?.ok) {
      throw new GitsError(
        reply?.code ?? 'maps_connection',
        reply?.error ?? 'Google Maps did not respond.',
      )
    }
    return reply.data
  }

  search(query: string) {
    return this.command<CandidateRef[]>({ operation: 'search', query })
  }

  scrollResults() {
    return this.command<CandidateRef[]>({ operation: 'scrollResults' })
  }

  openBusiness(candidate: CandidateRef) {
    return this.command<void>({ operation: 'openBusiness', candidate })
  }

  readBusiness(candidate: CandidateRef, query: string) {
    return this.command<LeadCandidate>({
      operation: 'readBusiness',
      candidate,
      query,
    })
  }

  backToResults() {
    return this.command<void>({ operation: 'backToResults' })
  }
}

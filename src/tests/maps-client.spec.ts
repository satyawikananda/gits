import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MapsClient } from '../background/maps-client'
import { researchStep } from '../background/research-runner'
import { MockDecisionEngine } from '../background/decision-engine'
import { createSession, defaultConfig } from '../shared/search'
import { GitsError } from '../shared/errors'

const mock = vi.hoisted(() => ({ sendMessage: vi.fn() }))
vi.mock('webextension-polyfill', () => ({
  default: { tabs: { sendMessage: mock.sendMessage } },
}))

beforeEach(() => {
  vi.useFakeTimers()
  mock.sendMessage.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('maps startup handshake', () => {
  it('keeps the Spa session running while the new Maps tab installs its listener', async () => {
    const session = createSession({
      ...defaultConfig,
      niche: 'Spa',
      location: 'Denpasar, Bali',
      keywords: ['spa', 'wellness', 'massage', 'beauty'],
      filters: { ...defaultConfig.filters, minimumRating: 4 },
      targetLeadCount: 10,
      decisionLimit: 20,
    })
    const candidate = {
      id: 'spa-one',
      name: 'Spa One',
      mapsUrl: 'https://www.google.com/maps/place/Spa/data=!1sspa-one',
    }
    mock.sendMessage
      .mockRejectedValueOnce(new Error('Receiving end does not exist.'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ ok: true, data: { ready: true } })
      .mockResolvedValueOnce({ ok: true, data: [candidate] })
    const engine = new MockDecisionEngine()
    const evaluate = vi.spyOn(engine, 'evaluateCandidate')
    const work = researchStep(session, {
      maps: new MapsClient(10),
      engine,
      checkpoint: async () => {},
      persist: async () => {},
    })
    await vi.advanceTimersByTimeAsync(500)
    await work
    expect(session).toMatchObject({
      status: 'running',
      phase: 'collecting',
      pending: [candidate],
      jevDecisionCount: 0,
      mockDecisionCount: 0,
    })
    expect(evaluate).not.toHaveBeenCalled()
    expect(mock.sendMessage).toHaveBeenLastCalledWith(10, {
      channel: 'gits-maps',
      command: { operation: 'search', query: 'Spa Denpasar, Bali' },
    }, { frameId: 0 })
  })

  it('returns a recoverable connection error after a bounded wait without dispatching search', async () => {
    mock.sendMessage.mockRejectedValue(new Error('Receiving end does not exist.'))
    const result = expect(new MapsClient(10).search('Spa Bali')).rejects.toMatchObject({
      code: 'maps_connection',
      message: expect.stringContaining('Reload that tab'),
    })
    await vi.advanceTimersByTimeAsync(15000)
    await result
    expect(mock.sendMessage.mock.calls.every(([, message]) => message.ping === true)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('honors pause while waiting and never dispatches a Maps operation after interruption', async () => {
    mock.sendMessage.mockRejectedValue(new Error('Receiving end does not exist.'))
    const checkpoint = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new GitsError('interrupted', 'Paused'))
    const result = expect(new MapsClient(10, checkpoint).search('Spa Bali')).rejects.toMatchObject({ code: 'interrupted' })
    await vi.advanceTimersByTimeAsync(250)
    await result
    expect(mock.sendMessage).toHaveBeenCalledOnce()
  })

  it('does not replay a dispatched operation when its response port closes', async () => {
    mock.sendMessage
      .mockResolvedValueOnce({ ok: true, data: { ready: true } })
      .mockRejectedValueOnce(new Error('Message port closed.'))
    await expect(new MapsClient(10).search('Spa Bali')).rejects.toMatchObject({
      code: 'maps_connection',
      message: expect.stringContaining('during search'),
    })
    expect(mock.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('preserves executor errors for the persisted session and popup', async () => {
    mock.sendMessage
      .mockResolvedValueOnce({ ok: true, data: { ready: true } })
      .mockResolvedValueOnce({ ok: false, code: 'maps_selectors', error: 'Missing search input' })
    await expect(new MapsClient(10).search('Spa Bali')).rejects.toMatchObject({
      code: 'maps_selectors',
      message: 'Missing search input',
    })
  })
})

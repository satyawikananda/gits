import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSession, defaultConfig } from '../shared/search'
import type { SearchSession } from '../shared/types'
import { handleCommand } from '../background/controller'
import { saveRunningSession } from '../background/storage'

const mock = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  create: vi.fn(async () => ({ id: 10 })),
  cancel: vi.fn(async () => ({ ok: true })),
  testConnection: vi.fn(async (_key: string) => {}),
}))
vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: async (keys: string | string[]) =>
          Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys]).map(k => [
              k,
              structuredClone(mock.data[k]),
            ]),
          ),
        set: async (values: Record<string, unknown>) => {
          Object.assign(mock.data, structuredClone(values))
        },
        remove: async (key: string) => {
          delete mock.data[key]
        },
      },
    },
    tabs: {
      create: mock.create,
      get: async () => ({
        id: 10,
        url: 'https://www.google.com/maps',
        status: 'complete',
      }),
      sendMessage: mock.cancel,
    },
    alarms: { create: vi.fn(), clear: vi.fn(async () => true) },
  },
}))
vi.mock('../background/decision-engine', async original => ({
  ...(await original<object>()),
  testJevConnection: mock.testConnection,
}))

beforeEach(() => {
  mock.data = {}
  vi.clearAllMocks()
  const queues = new Map<string, Promise<unknown>>()
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: async (
        name: string,
        options: unknown,
        callback?: (lock: unknown) => Promise<unknown>,
      ) => {
        // Controller tests explicitly leave the runner idle; workflow is tested separately.
        if (name === 'gits-runner')
          return callback?.(null)
        const run = options as () => Promise<unknown>
        const previous = queues.get(name) ?? Promise.resolve()
        const next = previous.catch(() => {}).then(run)
        queues.set(name, next)
        return next
      },
    },
  })
})
describe('background controller', () => {
  it('rejects late writes from before a pause/resume even when the session is running again', async () => {
    const previous = createSession({
      ...defaultConfig,
      niche: 'Coffee',
      location: 'Bali',
      engine: 'mock',
    })
    previous.tabId = 10
    mock.data['gits.session.v1'] = structuredClone(previous)
    await handleCommand({ type: 'pause' })
    await handleCommand({ type: 'resume' })
    previous.analyzedCount = 99
    await expect(saveRunningSession(previous)).rejects.toMatchObject({
      code: 'interrupted',
    })
    expect((await handleCommand({ type: 'snapshot' })).session).toMatchObject({
      analyzedCount: 0,
      status: 'running',
      controlVersion: 2,
    })
  })
  it('validates and stores a key locally, retests, replaces, removes, and never returns it in snapshots', async () => {
    const first = await handleCommand({
      type: 'connect',
      key: 'synthetic-first-key',
    })
    expect(first.connection).toEqual({ hasKey: true, connected: true })
    expect(JSON.stringify(first)).not.toContain('synthetic-first-key')
    expect(mock.data['gits.jevKey']).toBe('synthetic-first-key')
    await handleCommand({ type: 'connect' })
    expect(mock.testConnection).toHaveBeenLastCalledWith('synthetic-first-key')
    await handleCommand({ type: 'connect', key: 'synthetic-replacement-key' })
    expect(mock.data['gits.jevKey']).toBe('synthetic-replacement-key')
    await handleCommand({ type: 'remove-key' })
    expect(mock.data['gits.jevKey']).toBeUndefined()
    expect((await handleCommand({ type: 'snapshot' })).connection).toEqual({
      hasKey: false,
      connected: false,
    })
  })
  it('does not overwrite a working key if a replacement fails validation', async () => {
    await handleCommand({ type: 'connect', key: 'synthetic-first-key' })
    mock.testConnection.mockRejectedValueOnce(new Error('provider rejected'))
    await expect(
      handleCommand({ type: 'connect', key: 'bad-replacement' }),
    ).rejects.toThrow()
    expect(mock.data['gits.jevKey']).toBe('synthetic-first-key')
  })
  it('serializes simultaneous starts and preserves config, pause, resume and stop across snapshots', async () => {
    const config = {
      ...defaultConfig,
      niche: 'Coffee',
      location: 'Bali',
      engine: 'mock' as const,
    }
    const starts = await Promise.allSettled([
      handleCommand({ type: 'start', config }),
      handleCommand({ type: 'start', config }),
    ])
    expect(starts.map(s => s.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ])
    expect(mock.create).toHaveBeenCalledOnce()
    const paused = await handleCommand({ type: 'pause' })
    expect(paused.session).toMatchObject({
      status: 'paused',
      controlVersion: 1,
      niche: 'Coffee',
      location: 'Bali',
    })
    expect((await handleCommand({ type: 'snapshot' })).session?.id).toBe(
      paused.session?.id,
    )
    expect((await handleCommand({ type: 'resume' })).session).toMatchObject({
      status: 'running',
      controlVersion: 2,
    })
    expect((await handleCommand({ type: 'stop' })).session?.status).toBe(
      'stopped',
    )
  })
  it('keeps results when removing a key during research and rejects unvalidated live starts', async () => {
    const s: SearchSession = createSession({
      ...defaultConfig,
      niche: 'Coffee',
      location: 'Bali',
    })
    s.tabId = 10
    mock.data['gits.session.v1'] = s
    await handleCommand({ type: 'remove-key' })
    expect((mock.data['gits.session.v1'] as SearchSession).status).toBe(
      'paused',
    )
    expect(mock.cancel).toHaveBeenCalled()
    await handleCommand({ type: 'new-search' })
    await expect(
      handleCommand({
        type: 'start',
        config: { ...defaultConfig, niche: 'Coffee', location: 'Bali' },
      }),
    ).rejects.toMatchObject({ code: 'invalid_key' })
    expect(mock.create).not.toHaveBeenCalled()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  JevDecisionEngine,
  testJevConnection,
} from '../background/decision-engine'
import { defaultConfig } from '../shared/search'

afterEach(() => vi.unstubAllGlobals())
function response(answers: Record<string, unknown>) {
  return new Response(JSON.stringify({ answers }), { status: 200 })
}
describe('jev adapter through the installed advocaat client', () => {
  it('batches semantic questions into one direct Jev request and maps typed answers', async () => {
    const fetch = vi.fn(async () =>
      response({
        relevance: { type: 'noul', noul: 0.93 },
        qualification: { type: 'noul', noul: 0.88 },
        priority: { type: 'choice', choice: 'high', confidence: 0.9 },
        reason: { type: 'choice', choice: 'strong_fit', confidence: 0.9 },
      }),
    )
    vi.stubGlobal('fetch', fetch)
    const decision = await new JevDecisionEngine(
      'synthetic-test-key',
    ).evaluateCandidate({
      candidate: {
        id: 'one',
        name: 'Coffee',
        website: null,
        sourceQuery: 'Coffee Bali',
      },
      config: defaultConfig,
    })
    expect(decision).toMatchObject({
      relevant: true,
      qualified: true,
      priority: 'high',
      action: 'save',
      confidence: 0.88,
    })
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = (
      fetch.mock.calls as unknown as [string, RequestInit][]
    )[0]
    expect(url).toBe('https://api.typesafe.ai/v1/systemone')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('jev-latest')
    expect(Object.keys(body.questions)).toEqual([
      'relevance',
      'qualification',
      'priority',
      'reason',
    ])
    expect(init.body).not.toContain('synthetic-test-key')
  })
  it('returns review for ambiguous evidence and constrains next action output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          relevance: { type: 'noul', noul: 0.55 },
          qualification: { type: 'noul', noul: 0.6 },
          priority: { type: 'choice', choice: 'low' },
          reason: { type: 'choice', choice: 'uncertain' },
        }),
      ),
    )
    const engine = new JevDecisionEngine('synthetic-test-key')
    expect(
      await engine.evaluateCandidate({
        candidate: { id: 'one', name: 'Coffee', sourceQuery: '' },
        config: defaultConfig,
      }),
    ).toMatchObject({ qualified: false, action: 'review' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({ action: { type: 'choice', choice: 'continue_scrolling' } }),
      ),
    )
    expect(
      await engine.decideNextAction({
        config: defaultConfig,
        analyzedCount: 1,
        qualifiedCount: 0,
        pendingCount: 0,
        emptyScrolls: 0,
        hasNextQuery: false,
        recentDecisions: [],
      }),
    ).toBe('continue_scrolling')
  })
  it('redacts API error bodies and distinguishes invalid keys from request failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'synthetic-test-key' }), {
            status: 401,
          }),
      ),
    )
    await expect(testJevConnection('synthetic-test-key')).rejects.toMatchObject(
      { code: 'invalid_key' },
    )
    try {
      await testJevConnection('synthetic-test-key')
    }
    catch (error) {
      expect(String(error)).not.toContain('synthetic-test-key')
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('down', { status: 503 })),
    )
    await expect(testJevConnection('synthetic-test-key')).rejects.toMatchObject(
      { code: 'jev_request' },
    )
  })
})

import { describe, expect, it, vi } from 'vitest'
import type {
  CandidateRef,
  DecisionEngine,
  LeadCandidate,
  MapsExecutor,
  SearchSession,
} from '../shared/types'
import {
  createSession,
  defaultConfig,
  filterCandidate,
} from '../shared/search'
import { leadsToCsv } from '../shared/csv'
import { GitsError } from '../shared/errors'
import { MockDecisionEngine } from '../background/decision-engine'
import { cachedDecision } from '../background/budget-guard'
import { allowedAction, researchStep } from '../background/research-runner'

const candidate: LeadCandidate = {
  id: 'one',
  name: 'Coffee One',
  category: 'Coffee shop',
  sourceQuery: 'Coffee Bali',
  website: null,
  rating: 4.7,
  businessStatus: 'active',
  phone: '+621234',
}
function session() {
  return createSession({
    ...defaultConfig,
    niche: 'Coffee',
    location: 'Bali',
    engine: 'mock',
    targetLeadCount: 1,
  })
}
function harness(initial = session()) {
  let stored = structuredClone(initial)
  const ref: CandidateRef = {
    id: candidate.id,
    name: candidate.name,
    mapsUrl: 'https://www.google.com/maps/place/Coffee/data=!1sone',
  }
  const maps: MapsExecutor = {
    search: vi.fn(async () => [ref]),
    scrollResults: vi.fn(async () => []),
    openBusiness: vi.fn(async () => {}),
    readBusiness: vi.fn(async () => candidate),
    backToResults: vi.fn(async () => {}),
  }
  const engine: DecisionEngine = new MockDecisionEngine()
  const persist = async (s: SearchSession) => {
    stored = structuredClone(s)
  }
  const checkpoint = async () => {}
  return {
    maps,
    engine,
    persist,
    checkpoint,
    read: () => structuredClone(stored),
  }
}

describe('research workflow', () => {
  it('runs across persisted transitions, keeps qualified leads and stops at target without another decision', async () => {
    const h = harness()
    for (let i = 0; i < 8 && h.read().status === 'running'; i++)
      await researchStep(h.read(), h)
    expect(h.read()).toMatchObject({
      status: 'completed',
      qualifiedCount: 1,
      analyzedCount: 1,
      jevDecisionCount: 0,
      mockDecisionCount: 1,
    })
    expect(h.read().leads[0].decision).toMatchObject({
      qualified: true,
      priority: 'high',
    })
    expect(h.maps.openBusiness).toHaveBeenCalledOnce()
  })
  it('skips website, duplicates, closed and low-rating businesses before evaluating', async () => {
    for (const change of [
      { website: 'https://example.com' },
      { businessStatus: 'closed' as const },
      { rating: 2 },
    ]) {
      const s = session()
      s.filters.minimumRating = 4
      s.phase = 'evaluating'
      s.current = { ...candidate, ...change }
      const h = harness(s)
      const evaluate = vi.spyOn(h.engine, 'evaluateCandidate')
      await researchStep(s, h)
      expect(evaluate).not.toHaveBeenCalled()
      expect(h.read().leads).toEqual([])
    }
    expect(filterCandidate(candidate, session(), ['one'])).toBe(
      'Duplicate business',
    )
  })
  it('reserves calls before dispatch, caches equivalent decisions and cannot exceed the budget', async () => {
    const s = session()
    s.engine = 'jev'
    s.decisionLimit = 1
    const persist = vi.fn(async () => {})
    const request = vi.fn(async () => {
      expect(s.jevDecisionCount).toBe(1)
      expect(persist).toHaveBeenCalled()
      return 'finish' as const
    })
    expect(await cachedDecision(s, 'same', persist, request)).toBe('finish')
    expect(await cachedDecision(s, 'same', persist, request)).toBe('finish')
    await expect(
      cachedDecision(s, 'different', persist, request),
    ).rejects.toMatchObject({ code: 'budget_exhausted' })
    expect(request).toHaveBeenCalledOnce()
  })
  it('keeps failed-call reservations and stops safely at the limit', async () => {
    const s = session()
    s.phase = 'evaluating'
    s.current = candidate
    s.decisionLimit = 1
    s.mockDecisionCount = 1
    const h = harness(s)
    await researchStep(s, h)
    expect(h.read()).toMatchObject({
      status: 'stopped',
      errorCode: 'budget_exhausted',
    })
    const other = session()
    await expect(
      cachedDecision(
        other,
        'failure',
        async () => {},
        async () => {
          throw new Error('network')
        },
      ),
    ).rejects.toThrow()
    expect(other.mockDecisionCount).toBe(1)
  })
  it('pause during extraction prevents evaluation or saving the late result', async () => {
    const s = session()
    s.phase = 'collecting'
    s.pending = [
      {
        id: 'one',
        name: 'Coffee One',
        mapsUrl: 'https://www.google.com/maps/place/Coffee',
      },
    ]
    const h = harness(s)
    let paused = false
    h.maps.openBusiness = async () => {
      paused = true
    }
    h.checkpoint = async () => {
      if (paused)
        throw new GitsError('interrupted', 'Paused')
    }
    await researchStep(s, h)
    expect(h.maps.readBusiness).not.toHaveBeenCalled()
    expect(h.read().leads).toEqual([])
  })
  it('finishes exhausted searches and bounds unavailable engine actions', async () => {
    const s = session()
    s.phase = 'continuing'
    s.emptyScrolls = 2
    const h = harness(s)
    const decision = vi.spyOn(h.engine, 'decideNextAction')
    await researchStep(s, h)
    expect(h.read().status).toBe('completed')
    expect(decision).not.toHaveBeenCalled()
    expect(allowedAction(s, 'change_query')).toBe('finish')
    s.emptyScrolls = 0
    expect(allowedAction(s, 'inspect_next')).toBe('continue_scrolling')
  })
  it.each(['finish', 'change_query'] as const)('does not let %s discard queued prospects after a website rejection', async (action) => {
    const s = session()
    s.engine = 'jev'
    s.keywords = ['specialty']
    s.queries.push('Coffee specialty Bali')
    const h = harness(s)
    const listed = { ...candidate, id: 'listed', website: 'https://example.com' }
    const refs = [listed, candidate].map(c => ({
      id: c.id,
      name: c.name,
      mapsUrl: `https://www.google.com/maps/place/Coffee/data=!1s${c.id}`,
    }))
    h.maps.search = vi.fn(async () => refs)
    h.maps.readBusiness = vi.fn(async ref => ref.id === listed.id ? listed : candidate)
    const evaluate = vi.spyOn(h.engine, 'evaluateCandidate')
    vi.spyOn(h.engine, 'decideNextAction').mockResolvedValue(action)

    for (let i = 0; i < 15 && h.read().status === 'running'; i++)
      await researchStep(h.read(), h)

    expect(h.read()).toMatchObject({
      status: 'completed',
      message: 'Target reached.',
      analyzedCount: 2,
      qualifiedCount: 1,
      queryIndex: 0,
      decisionLimit: 100,
    })
    expect(h.read().leads[0].id).toBe(candidate.id)
    expect(h.read().activity).toContainEqual({ name: listed.name, reason: 'Skipped: Website listed' })
    expect(evaluate).toHaveBeenCalledOnce()
    expect(h.maps.search).toHaveBeenCalledOnce()
  })
  it('keeps scrolling after rejected prospects even when the engine requests finish', async () => {
    const s = session()
    s.engine = 'jev'
    const h = harness(s)
    const rejected = { ...candidate, id: 'rejected', name: 'Hardware One', category: 'Hardware store' }
    h.maps.search = vi.fn(async () => [{
      id: rejected.id,
      name: rejected.name,
      mapsUrl: 'https://www.google.com/maps/place/Hardware',
    }])
    h.maps.readBusiness = vi.fn(async ref => ref.id === rejected.id ? rejected : candidate)
    h.maps.scrollResults = vi.fn(async () => [{
      id: candidate.id,
      name: candidate.name,
      mapsUrl: 'https://www.google.com/maps/place/Coffee',
    }])
    vi.spyOn(h.engine, 'decideNextAction').mockResolvedValue('finish')

    for (let i = 0; i < 15 && h.read().status === 'running'; i++)
      await researchStep(h.read(), h)

    expect(h.read()).toMatchObject({ status: 'completed', qualifiedCount: 1, analyzedCount: 2 })
    expect(h.read().leads[0].id).toBe(candidate.id)
    expect(h.maps.scrollResults).toHaveBeenCalledOnce()
  })
  it('tries remaining user queries before finishing with no qualified leads', async () => {
    const s = session()
    s.queries.push('Coffee specialty Bali')
    s.phase = 'continuing'
    s.emptyScrolls = 2
    const h = harness(s)
    h.maps.search = vi.fn(async () => [])
    vi.spyOn(h.engine, 'decideNextAction').mockResolvedValue('finish')

    await researchStep(h.read(), h)
    expect(h.read()).toMatchObject({ status: 'running', phase: 'searching', queryIndex: 1 })
    for (let i = 0; i < 10 && h.read().status === 'running'; i++)
      await researchStep(h.read(), h)

    expect(h.read()).toMatchObject({ status: 'completed', qualifiedCount: 0, pending: [] })
    expect(h.maps.search).toHaveBeenCalledWith('Coffee specialty Bali')
    expect(h.read().mockDecisionCount).toBeLessThan(s.decisionLimit)
  })
  it('pauses on a Jev failure without discarding earlier results', async () => {
    const s = session()
    s.phase = 'evaluating'
    s.current = candidate
    const h = harness(s)
    h.engine.evaluateCandidate = async () => {
      throw new GitsError('jev_request', 'Retry later')
    }
    await researchStep(s, h)
    expect(h.read()).toMatchObject({
      status: 'paused',
      errorCode: 'jev_request',
      current: candidate,
      mockDecisionCount: 1,
    })
  })
  it('uses only the original niche/location and user keywords for query variants', () => {
    const s = createSession({
      ...defaultConfig,
      niche: 'Coffee',
      location: 'Bali',
      keywords: ['specialty', 'specialty'],
    })
    expect(s.queries).toEqual(['Coffee Bali', 'Coffee specialty Bali'])
    expect(() =>
      createSession({ ...defaultConfig, targetLeadCount: Number.NaN }),
    ).toThrow()
  })
})

describe('cSV export', () => {
  it('exports only saved qualified leads, escapes fields and blocks spreadsheet formulas', async () => {
    const decision = await new MockDecisionEngine().evaluateCandidate({
      candidate,
      config: session(),
    })
    const csv = leadsToCsv([
      {
        ...candidate,
        name: '=HYPERLINK("bad")',
        address: 'Street, "Bali"\nIndonesia',
        decision,
        collectedAt: 0,
      },
      {
        ...candidate,
        decision: { ...decision, qualified: false },
        collectedAt: 0,
      },
    ])
    expect(csv).toContain(
      'name,category,address,rating,review_count,website,phone,maps_url,priority,qualification_reason,source_query',
    )
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"')
    expect(csv).toContain('"Street, ""Bali""\nIndonesia"')
    expect(csv.match(/Coffee shop/g)).toHaveLength(1)
    expect(csv).not.toContain('jevKey')
  })
})

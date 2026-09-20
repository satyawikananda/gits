import type {
  CandidateRef,
  DecisionEngine,
  MapsExecutor,
  ResearchAction,
  SearchConfig,
  SearchSession,
} from '../shared/types'
import { filterCandidate } from '../shared/search'
import { GitsError, safeError } from '../shared/errors'
import { cachedDecision } from './budget-guard'

export interface RunnerDependencies {
  maps: MapsExecutor
  engine: DecisionEngine
  persist: (session: SearchSession) => Promise<void>
  checkpoint: () => Promise<void>
}
function configOf(s: SearchSession): SearchConfig {
  return {
    niche: s.niche,
    location: s.location,
    keywords: s.keywords,
    targetLeadCount: s.targetLeadCount,
    filters: s.filters,
    decisionLimit: s.decisionLimit,
    engine: s.engine,
  }
}
function enqueue(s: SearchSession, candidates: CandidateRef[]) {
  const known = new Set([...s.seen, ...s.pending.map(c => c.id)])
  const fresh = candidates.filter(c => !known.has(c.id) && known.add(c.id))
  s.pending.push(...fresh)
  s.emptyScrolls = fresh.length ? 0 : s.emptyScrolls + 1
}
function record(s: SearchSession, name: string, reason: string) {
  s.activity = [{ name, reason }, ...s.activity].slice(0, 40)
}
export function allowedAction(
  s: SearchSession,
  requested: ResearchAction,
): ResearchAction {
  // An AI recommendation must not discard unread candidates or end a search
  // while more results or user-derived queries are still available.
  if (s.pending.length)
    return 'inspect_next'
  if (requested === 'change_query' && s.queryIndex + 1 < s.queries.length)
    return 'change_query'
  if (s.emptyScrolls < 2)
    return 'continue_scrolling'
  return s.queryIndex + 1 < s.queries.length ? 'change_query' : 'finish'
}
// A durable transition, independent of the popup lifecycle.
export async function researchStep(
  s: SearchSession,
  deps: RunnerDependencies,
): Promise<void> {
  const { maps, engine, checkpoint } = deps
  const persist = async () => {
    s.updatedAt = Date.now()
    await deps.persist(s)
  }
  if (s.status !== 'running')
    return
  try {
    await checkpoint()
    if (s.leads.length >= s.targetLeadCount) {
      s.status = 'completed'
      s.message = 'Target reached.'
      await persist()
      return
    }
    switch (s.phase) {
      case 'searching': {
        s.message = `Searching ${s.queries[s.queryIndex]}…`
        await persist()
        const candidates = await maps.search(s.queries[s.queryIndex])
        await checkpoint()
        s.pending = []
        s.emptyScrolls = 0
        enqueue(s, candidates)
        s.phase = s.pending.length ? 'collecting' : 'continuing'
        break
      }
      case 'collecting': {
        const candidate = s.pending[0]
        if (!candidate) {
          s.phase = 'continuing'
          break
        }
        s.message = `Reading ${candidate.name}…`
        await persist()
        await maps.openBusiness(candidate)
        await checkpoint()
        s.current = await maps.readBusiness(candidate, s.queries[s.queryIndex])
        await checkpoint()
        s.phase = 'evaluating'
        break
      }
      case 'evaluating': {
        if (!s.current) {
          throw new GitsError(
            'session_invalid',
            'The pending business is unavailable. Start a new search.',
          )
        }
        const candidate = s.current
        const filter = filterCandidate(candidate, s, s.seen)
        if (filter) {
          record(s, candidate.name, `Skipped: ${filter}`)
        }
        else {
          s.message = `${s.engine === 'mock' ? 'Mock' : 'Jev'} decision for ${candidate.name}…`
          const input = { candidate, config: configOf(s) }
          const decision = await cachedDecision(
            s,
            `candidate:${JSON.stringify(input)}`,
            persist,
            () => engine.evaluateCandidate(input),
          )
          await checkpoint()
          if (decision.qualified && decision.action === 'save')
            s.leads.push({ ...candidate, decision, collectedAt: Date.now() })
          record(s, candidate.name, decision.reason)
        }
        s.seen.push(candidate.id)
        s.pending = s.pending.filter(c => c.id !== candidate.id)
        s.analyzedCount++
        s.qualifiedCount = s.leads.length
        s.phase = 'continuing'
        break
      }
      case 'continuing': {
        await maps.backToResults()
        await checkpoint()
        const state = {
          config: configOf(s),
          pendingCount: s.pending.length,
          qualifiedCount: s.qualifiedCount,
          analyzedCount: s.analyzedCount,
          emptyScrolls: s.emptyScrolls,
          hasNextQuery: s.queryIndex + 1 < s.queries.length,
          recentDecisions: s.activity.slice(0, 5),
        }
        const exhausted
          = !s.pending.length && s.emptyScrolls >= 2 && !state.hasNextQuery
        const action = exhausted
          ? 'finish'
          : allowedAction(
              s,
              await cachedDecision(
                s,
                `action:${s.queryIndex}:${JSON.stringify(state)}`,
                persist,
                () => engine.decideNextAction(state),
              ),
            )
        await checkpoint()
        if (action === 'inspect_next') {
          s.phase = 'collecting'
        }
        else if (action === 'change_query') {
          s.queryIndex++
          s.phase = 'searching'
        }
        else if (action === 'continue_scrolling') {
          s.message = 'Loading more businesses…'
          await persist()
          const candidates = await maps.scrollResults()
          await checkpoint()
          enqueue(s, candidates)
          s.phase = s.pending.length ? 'collecting' : 'continuing'
        }
        else {
          s.status = 'completed'
          s.message
            = `No new businesses found across the configured queries. ${s.analyzedCount} businesses analyzed; ${s.leads.length} qualified leads saved.`
        }
        break
      }
    }
    await persist()
  }
  catch (error) {
    const safe = safeError(error)
    if (safe.code === 'interrupted')
      return
    s.status
      = safe.code === 'budget_exhausted' || safe.code === 'maps_blocked'
        ? 'stopped'
        : safe.code.startsWith('jev') || safe.code === 'invalid_key'
          ? 'paused'
          : 'error'
    s.errorCode = safe.code
    s.message = safe.message
    await persist()
  }
}

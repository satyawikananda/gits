import type {
  LeadDecision,
  ResearchAction,
  SearchSession,
} from '../shared/types'
import { GitsError } from '../shared/errors'

export async function cachedDecision<T extends LeadDecision | ResearchAction>(
  session: SearchSession,
  key: string,
  persist: () => Promise<void>,
  request: () => Promise<T>,
): Promise<T> {
  const cached = session.cache[key]
  if (cached !== undefined)
    return cached as T
  const used
    = session.engine === 'jev'
      ? session.jevDecisionCount
      : session.mockDecisionCount
  if (used >= session.decisionLimit) {
    throw new GitsError(
      'budget_exhausted',
      'Decision limit reached. Saved leads are ready to review and export.',
    )
  }
  if (session.engine === 'jev')
    session.jevDecisionCount++
  else session.mockDecisionCount++
  await persist()
  const result = await request()
  session.cache[key] = result
  await persist()
  return result
}

import type { LeadCandidate, SearchConfig, SearchSession } from './types'
import { GitsError } from './errors'

export const defaultConfig: SearchConfig = {
  niche: '',
  location: '',
  keywords: [],
  targetLeadCount: 25,
  filters: { withoutWebsite: true, activeBusiness: true },
  decisionLimit: 100,
  engine: 'jev',
}
export function validateConfig(config: SearchConfig) {
  if (
    !config
    || typeof config.niche !== 'string'
    || typeof config.location !== 'string'
    || !config.niche.trim()
    || !config.location.trim()
    || config.niche.length > 120
    || config.location.length > 180
    || !Array.isArray(config.keywords)
    || config.keywords.length > 8
    || config.keywords.some(k => typeof k !== 'string' || k.length > 80)
    || !Number.isInteger(config.targetLeadCount)
    || config.targetLeadCount < 1
    || config.targetLeadCount > 500
    || !Number.isInteger(config.decisionLimit)
    || config.decisionLimit < 1
    || config.decisionLimit > 1000
    || !['jev', 'mock'].includes(config.engine)
    || !config.filters
    || typeof config.filters.withoutWebsite !== 'boolean'
    || typeof config.filters.activeBusiness !== 'boolean'
    || (config.filters.minimumRating !== undefined
      && (!Number.isFinite(config.filters.minimumRating)
        || config.filters.minimumRating < 0
        || config.filters.minimumRating > 5))
  ) {
    throw new GitsError(
      'invalid_config',
      'Enter a niche, location, valid lead target (1–500), and decision limit (1–1000).',
    )
  }
}
export function createSession(config: SearchConfig): SearchSession {
  validateConfig(config)
  const queries = [
    ...new Set([
      `${config.niche} ${config.location}`,
      ...config.keywords
        .filter(k => k.trim())
        .map(k => `${config.niche} ${k.trim()} ${config.location}`),
    ]),
  ]
  return {
    ...structuredClone(config),
    id: crypto.randomUUID(),
    controlVersion: 0,
    status: 'running',
    phase: 'searching',
    queries,
    queryIndex: 0,
    pending: [],
    seen: [],
    leads: [],
    activity: [],
    analyzedCount: 0,
    qualifiedCount: 0,
    jevDecisionCount: 0,
    mockDecisionCount: 0,
    emptyScrolls: 0,
    cache: {},
    message: 'Preparing Google Maps…',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
export function filterCandidate(
  candidate: LeadCandidate,
  config: SearchConfig,
  seen: string[],
): string | null {
  if (!candidate.id || !candidate.name.trim())
    return 'Incomplete business record'
  if (seen.includes(candidate.id))
    return 'Duplicate business'
  if (config.filters.withoutWebsite && candidate.website)
    return 'Website listed'
  if (config.filters.withoutWebsite && candidate.website === undefined)
    return 'Website status could not be verified'
  if (
    config.filters.minimumRating !== undefined
    && (candidate.rating === undefined
      || candidate.rating < config.filters.minimumRating)
  ) {
    return 'Below minimum rating or rating unavailable'
  }
  if (config.filters.activeBusiness && candidate.businessStatus === 'closed')
    return 'Business marked closed'
  return null
}

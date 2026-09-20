export type EngineMode = 'jev' | 'mock'

export type ResearchAction =
  | 'inspect_next'
  | 'continue_scrolling'
  | 'change_query'
  | 'finish'

export type LeadPriority = 'high' | 'medium' | 'low'

export interface SearchConfig {
  niche: string
  location: string
  keywords: string[]
  targetLeadCount: number
  filters: {
    withoutWebsite: boolean
    activeBusiness: boolean
    minimumRating?: number
  }
  decisionLimit: number
  engine: EngineMode
}

export interface LeadCandidate {
  id: string
  name: string
  category?: string
  address?: string
  location?: string
  rating?: number
  reviewCount?: number
  website?: string | null
  phone?: string | null
  mapsUrl?: string
  description?: string
  businessStatus?: 'active' | 'closed' | 'unknown'
  sourceQuery: string
}

export interface LeadDecision {
  relevant: boolean
  qualified: boolean
  priority: LeadPriority
  confidence?: number
  reason: string
  action: 'save' | 'skip' | 'review'
}

export interface QualifiedLead extends LeadCandidate {
  decision: LeadDecision
  collectedAt: number
}

export interface CandidateDecisionInput {
  candidate: LeadCandidate
  config: SearchConfig
}

export interface ResearchState {
  config: SearchConfig
  pendingCount: number
  qualifiedCount: number
  analyzedCount: number
  emptyScrolls: number
  hasNextQuery: boolean
  recentDecisions: { name: string, reason: string }[]
}

export interface DecisionEngine {
  evaluateCandidate: (
    input: CandidateDecisionInput,
    signal?: AbortSignal,
  ) => Promise<LeadDecision>
  decideNextAction: (
    input: ResearchState,
    signal?: AbortSignal,
  ) => Promise<ResearchAction>
}

export interface CandidateRef {
  id: string
  name: string
  mapsUrl: string
}

export type SessionStatus =
  | 'running'
  | 'paused'
  | 'completed'
  | 'stopped'
  | 'error'

export interface SearchSession extends SearchConfig {
  id: string
  controlVersion: number
  status: SessionStatus
  phase: 'searching' | 'collecting' | 'evaluating' | 'continuing'
  tabId?: number
  queries: string[]
  queryIndex: number
  pending: CandidateRef[]
  seen: string[]
  current?: LeadCandidate
  leads: QualifiedLead[]
  activity: { name: string, reason: string }[]
  analyzedCount: number
  qualifiedCount: number
  jevDecisionCount: number
  mockDecisionCount: number
  emptyScrolls: number
  cache: Record<string, LeadDecision | ResearchAction>
  message: string
  errorCode?: string
  createdAt: number
  updatedAt: number
}

export interface Settings {
  engine: EngineMode
  decisionLimit: number
  theme: 'light' | 'dark' | 'system'
}

export interface Connection {
  connected: boolean
  hasKey: boolean
}

export interface Snapshot {
  session: SearchSession | null
  settings: Settings
  connection: Connection
}

export type Command =
  | { type: 'snapshot' }
  | { type: 'start', config: SearchConfig }
  | { type: 'pause' | 'resume' | 'stop' | 'new-search' | 'remove-key' }
  | { type: 'connect', key?: string }
  | { type: 'settings', settings: Settings }

export type Reply<T> = { ok: true, data: T } | { ok: false, error: string }

export type MapsCommand =
  | { operation: 'search', query: string }
  | { operation: 'scrollResults' | 'backToResults' }
  | { operation: 'openBusiness', candidate: CandidateRef }
  | { operation: 'readBusiness', candidate: CandidateRef, query: string }

export interface MapsExecutor {
  search: (query: string) => Promise<CandidateRef[]>
  scrollResults: () => Promise<CandidateRef[]>
  openBusiness: (candidate: CandidateRef) => Promise<void>
  readBusiness: (
    candidate: CandidateRef,
    query: string,
  ) => Promise<LeadCandidate>
  backToResults: () => Promise<void>
}

export type Bucket = 'today' | 'backlog' | 'waiting' | 'someday' | 'reference'

export interface Item {
  file: string
  title?: string
  body?: string
  bucket?: Bucket
  tags?: string[]
  created?: string
  due?: string | null
  today_since?: string | null
  delegado_a?: string[]
  area?: string | null
  project?: string | null
  location?: string | null
  markdownified?: boolean
  estimate_minutes?: number | null
  /** false = classifier used the low-confidence fallback prompt, pending review. Absent/true/null = confirmed. */
  confirmed?: boolean | null
  /** Importance, not urgency — bucket + due already cover urgency. Absent = unprioritized. */
  priority?: 'low' | 'medium' | 'high' | null
}

export type Priority = 'low' | 'medium' | 'high'

export type BucketsMap = Record<Bucket, Item[]>

/** Dimension a cross-bucket FacetView groups by. */
export type Facet = 'tag' | 'project' | 'location' | 'area'

export interface Op {
  op: string
  bucket?: Bucket | 'now' | 'discard'
  title?: string
  file?: string
  filed?: boolean
  appended?: string
  error?: string
  message?: string
  requires_confirmation?: boolean
  target_file?: string
  new_bucket?: string
  current_body?: string
  proposed_body?: string
  /** Present on requires_confirmation ops — the chat message id to send back to POST /api/chat/confirm. */
  chat_ref?: string
  /** On `create`: false when the classifier used the low-confidence fallback prompt. */
  confirmed?: boolean
  /** Set by GET /api/chat/history on rehydration — whether a requires_confirmation op was already resolved. */
  resolved?: boolean
}

export interface ChatResponse {
  fallback: boolean
  ops: Op[]
}

export interface ChatHistoryEntry {
  id: string
  ts: string
  role: 'user' | 'assistant'
  text?: string
  fallback?: boolean
  ops?: Op[]
}

export interface EventEntry {
  id: string
  ts: string
  actor: 'user' | 'llm'
  kind: 'mutation' | 'undo'
  op: string | null
  file: string
  title: string
  confirmation: 'none' | 'confirmed'
  undoes: string | null
}

export interface ReviewData {
  week_stats: { stale?: number; completed: number; dismissed?: number; due_soon?: number }
  stale_today: Item[]
  due_this_week: Item[]
  completed_this_week: Item[]
}

export interface ProviderInfo {
  id: string
  label: string
  status: 'UP' | 'DOWN'
}

export interface ProvidersResponse {
  active: string
  providers: ProviderInfo[]
}

/** System tags never shown as user-facing context tags. */
export const SYSTEM_TAGS = new Set(['reference', 'project'])

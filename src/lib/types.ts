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
  markdownified?: boolean
  estimate_minutes?: number | null
}

export type BucketsMap = Record<Bucket, Item[]>

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
}

export interface ChatResponse {
  fallback: boolean
  ops: Op[]
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
export const SYSTEM_TAGS = new Set(['gtd', 'action', 'reference', 'project'])

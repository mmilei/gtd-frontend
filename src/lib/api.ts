import type { BucketsMap, ChatHistoryEntry, ChatResponse, EventEntry, Item, ProvidersResponse, ReviewData } from './types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

const json = (body: unknown, method: 'POST' | 'PUT' = 'POST'): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export function chat(message: string): Promise<ChatResponse> {
  return request('/chat', json({ message }))
}

export function getBuckets(): Promise<BucketsMap> {
  return request('/buckets')
}

export function getBucket(bucket: string): Promise<Item[]> {
  return request(`/buckets/${encodeURIComponent(bucket)}`)
}

export function getToday(): Promise<Item[]> {
  return request('/today')
}

export function fetchItem(filename: string): Promise<Item> {
  return request(`/items/${encodeURIComponent(filename)}`)
}

export function markDone(filename: string): Promise<Item> {
  return request(`/items/${encodeURIComponent(filename)}/done`, { method: 'POST' })
}

export function dismissItem(filename: string): Promise<Item> {
  return request(`/items/${encodeURIComponent(filename)}/dismiss`, { method: 'POST' })
}

export function moveItem(filename: string, bucket: string, due: string | null = null): Promise<Item> {
  return request(`/items/${encodeURIComponent(filename)}/move`, json({ bucket, due }))
}

export function patchMeta(filename: string, meta: Partial<Item>): Promise<Item> {
  return request(`/items/${encodeURIComponent(filename)}/meta`, json(meta, 'PUT'))
}

export function replaceBody(filename: string, body: string): Promise<Item> {
  return request(`/items/${encodeURIComponent(filename)}/body`, json({ body }, 'PUT'))
}

export function markdownifyItem(filename: string): Promise<{ file: string; body: string; tags: string[] }> {
  return request(`/items/${encodeURIComponent(filename)}/markdownify`, { method: 'POST' })
}

export function getReview(params: Record<string, string> = {}): Promise<ReviewData> {
  const q = new URLSearchParams(params).toString()
  return request(`/review${q ? '?' + q : ''}`)
}

export function undo(): Promise<{ undone: boolean }> {
  return request('/undo', { method: 'POST' })
}

/** Approves an edit/update/dismiss the LLM proposed (requires_confirmation ops from POST /chat) — distinct from the generic PUT /body and POST /dismiss a direct edit uses. */
export function confirmChatOp(body: {
  target_file: string
  op: string
  proposed_body?: string
  chat_ref?: string
}): Promise<{ confirmed: boolean; file: string; op: string }> {
  return request('/chat/confirm', json(body))
}

/** Flips a low-confidence task's confirmed:false -> true after review. */
export function confirmItem(filename: string): Promise<{ confirmed: boolean; file: string }> {
  return request(`/items/${encodeURIComponent(filename)}/confirm`, { method: 'POST' })
}

export function getChatHistory(limit = 50): Promise<ChatHistoryEntry[]> {
  return request(`/chat/history?limit=${limit}`)
}

export function getEvents(params: { limit?: number; actor?: string; op?: string } = {}): Promise<EventEntry[]> {
  const q = new URLSearchParams()
  if (params.limit) q.set('limit', String(params.limit))
  if (params.actor) q.set('actor', params.actor)
  if (params.op) q.set('op', params.op)
  const qs = q.toString()
  return request(`/events${qs ? '?' + qs : ''}`)
}

export function transcribe(audioBlob: Blob): Promise<{ text: string }> {
  const form = new FormData()
  form.append('audio', audioBlob, 'recording.webm')
  return request('/transcribe', { method: 'POST', body: form })
}

export function getProviders(): Promise<ProvidersResponse> {
  return request('/providers')
}

export function selectProvider(id: string): Promise<{ active: string }> {
  return request('/providers/select', json({ provider: id }))
}

export async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/buckets`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

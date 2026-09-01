import type { Bucket, BucketsMap, ChatHistoryEntry, ChatResponse, EventEntry, Item, LlmAction, ProvidersResponse, ReviewData, VaultPage } from './types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...init, cache: 'no-store' })
  } catch {
    throw new Error('Could not reach the server — is the Java server running on :8080?')
  }
  if (!res.ok) {
    let message: string
    try {
      const body = await res.json()
      // LLM provider errors carry "message"; validation errors carry "error"
      if (typeof body?.message === 'string') message = body.message
      else if (typeof body?.error === 'string') message = body.error
      else message = `HTTP ${res.status}`
    } catch {
      // Backend errors always come back as JSON (GlobalExceptionHandler). A non-JSON
      // body means this response came from the dev proxy/infra, not the app — e.g.
      // Vite's proxy answers with a plain-text 500 when :8080 is unreachable.
      message = 'Could not reach the server — is the Java server running on :8080?'
    }
    throw new Error(message)
  }
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

/** Low-confidence captures (confirmed:false) awaiting review — same Item shape as the bucket lists. */
export function getUnconfirmed(): Promise<Item[]> {
  return request('/unconfirmed')
}

/** The backend's configured `area` vocabulary (gtd.areas), in display order — the single source of truth for area UI. */
export function getAreas(): Promise<string[]> {
  return request('/areas')
}

export function fetchItem(filename: string): Promise<Item> {
  return request(`/items/${encodeURIComponent(filename)}`)
}

/** Files a task straight from user-entered fields — no classifier call, unlike chat(). */
export function createItem(
  item: Partial<Item> & { bucket: Bucket; title: string },
): Promise<{ filed: boolean; file: string; bucket: string; title: string }> {
  return request('/items', json(item))
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

/** `language` is a BCP-47 tag (e.g. es-AR, en-US) forwarded to Whisper so it decodes in the right language. */
export function transcribe(audioBlob: Blob, language = 'es-AR'): Promise<{ text: string }> {
  const form = new FormData()
  form.append('audio', audioBlob, 'recording.webm')
  form.append('language', language)
  return request('/transcribe', { method: 'POST', body: form })
}

export function getProviders(): Promise<ProvidersResponse> {
  return request('/providers')
}

export function selectProvider(action: LlmAction, provider: string): Promise<{ action: string; active: string }> {
  return request('/providers/select', json({ action, provider }))
}

export function getPeople(): Promise<VaultPage[]> {
  return request('/people')
}

/**
 * Creates a person page in brain/entities/ — what the editor's `@` autocomplete offers when what
 * was typed matches nobody. A blank or already-taken name comes back as a 400 whose `error` the
 * shared request() turns into the thrown message.
 */
export function createPerson(name: string): Promise<{ created: boolean; name: string }> {
  return request('/people', json({ name }))
}

export function getPages(): Promise<VaultPage[]> {
  return request('/pages')
}

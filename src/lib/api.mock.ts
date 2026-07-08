// In-memory GTD state for demo/GitHub Pages deployment.
// Substituted for ./api by the vite.config.ts alias when VITE_MOCK=true.
import type { Bucket, BucketsMap, ChatHistoryEntry, ChatResponse, EventEntry, Item, ProvidersResponse, ReviewData } from './types'
import type * as RealApi from './api'

function todayStr(): string {
  // local date, not UTC — after 21:00 GMT-3 toISOString() would already say "tomorrow"
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function makeFilename(title: string): string {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15)
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `${ts}-${slug}.md`
}

const state: Record<Bucket, Item[]> = {
  today: [
    { file: '20260628-090000-review-team-pull-request.md', bucket: 'today', title: 'Review team pull request', due: todayStr(), tags: ['work', 'code'], body: '', created: '2026-06-28', today_since: '2026-06-28', estimate_minutes: 45, project: 'gtd-frontend' },
    { file: '20260628-095500-call-the-dentist.md', bucket: 'today', title: 'Call the dentist', due: todayStr(), tags: ['health'], body: '', created: '2026-06-28', today_since: '2026-06-28', estimate_minutes: 10, area: 'salud' },
  ],
  backlog: [
    { file: '20260627-150000-write-project-readme.md', bucket: 'backlog', title: 'Write project README', tags: ['work'], body: '', created: '2026-06-27', project: 'gtd-frontend', area: 'trabajo' },
    { file: '20260627-160000-buy-hardware-supplies.md', bucket: 'backlog', title: 'Buy screws and wall plugs', tags: ['shopping'], body: '', created: '2026-06-27', location: 'ferretería', area: 'hogar' },
  ],
  waiting: [
    { file: '20260625-110000-wait-for-design-team.md', bucket: 'waiting', title: 'Wait for design team response', delegado_a: ['design team'], tags: [], body: '', created: '2026-06-25', project: 'java-gtd' },
  ],
  someday: [
    { file: '20260620-120000-learn-rust.md', bucket: 'someday', title: 'Learn Rust', tags: [], body: '', created: '2026-06-20' },
  ],
  reference: [
    {
      file: '20260615-080000-gtd-getting-things-done.md',
      bucket: 'reference',
      title: 'GTD — Getting Things Done',
      tags: ['productivity', 'methodology'],
      body: 'Personal organization system by David Allen.\n\n- **now**: 2 min or less, do it immediately\n- **today**: pending for today\n- **backlog**: someday, no date\n- **waiting**: delegated, awaiting response\n- **someday**: maybe, no commitment\n- **reference**: information, no action required',
      created: '2026-06-15',
    },
  ],
}

const KEYWORDS: Record<Exclude<Bucket, 'backlog'>, string[]> = {
  today: ['hoy', 'urgente', 'ahora', 'today', 'urgent', 'asap', 'esta tarde', 'esta mañana'],
  someday: ['someday', 'algún día', 'algun dia', 'quizás', 'quizas', 'maybe', 'alguna vez', 'en algún momento'],
  waiting: ['esperar', 'espero', 'delegar', 'delegá', 'waiting', 'esperando', 'cuando me confirmen', 'cuando respondan'],
  reference: ['referencia', 'ref', 'info', 'leer', 'read', 'guardar', 'nota sobre', 'apunte', 'documentación'],
}

function classify(message: string): Bucket {
  const lower = message.toLowerCase()
  for (const [bucket, keywords] of Object.entries(KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return bucket as Bucket
  }
  return 'backlog'
}

function extractTitle(message: string): string {
  return message.trim().replace(/[.!?]+$/, '').replace(/^./, c => c.toUpperCase()).slice(0, 80)
}

function findItem(filename: string): { item: Item; bucket: Bucket; idx: number } | null {
  for (const [bucket, items] of Object.entries(state)) {
    const idx = items.findIndex(i => i.file === filename)
    if (idx !== -1) return { item: items[idx], bucket: bucket as Bucket, idx }
  }
  return null
}

/** Find the item, remove it from its bucket, and return it. Throws if absent. */
function takeItem(filename: string): Item {
  const found = findItem(filename)
  if (!found) throw new Error('Item not found')
  state[found.bucket].splice(found.idx, 1)
  return found.item
}

export async function chat(message: string): Promise<ChatResponse> {
  const bucket = classify(message)
  const title = extractTitle(message)
  const file = makeFilename(title)
  const item: Item = {
    file,
    bucket,
    title,
    tags: [],
    body: '',
    created: todayStr(),
    ...(bucket === 'today' ? { due: todayStr(), today_since: todayStr() } : {}),
    ...(bucket === 'waiting' ? { delegado_a: [] } : {}),
  }
  state[bucket].unshift(item)
  return { fallback: false, ops: [{ op: 'create', filed: true, bucket, title, file }] }
}

export async function getBuckets(): Promise<BucketsMap> {
  return Object.fromEntries(
    Object.entries(state).map(([k, v]) => [k, v.map(i => ({ ...i }))]),
  ) as BucketsMap
}

export async function getBucket(bucket: string): Promise<Item[]> {
  return (state[bucket as Bucket] ?? []).map(i => ({ ...i }))
}

export function getToday(): Promise<Item[]> {
  return getBucket('today')
}

export async function fetchItem(filename: string): Promise<Item> {
  const found = findItem(filename)
  if (!found) throw new Error('Item not found')
  return { ...found.item }
}

export async function markDone(filename: string): Promise<Item> {
  return { ...takeItem(filename) }
}

export async function dismissItem(filename: string): Promise<Item> {
  return { ...takeItem(filename) }
}

export async function moveItem(filename: string, bucket: string, due: string | null = null): Promise<Item> {
  const item: Item = { ...takeItem(filename), bucket: bucket as Bucket }
  if (due) item.due = due
  if (bucket === 'today' && !item.today_since) item.today_since = todayStr()
  state[bucket as Bucket].unshift(item)
  return { ...item }
}

export async function patchMeta(filename: string, meta: Partial<Item>): Promise<Item> {
  const found = findItem(filename)
  if (!found) throw new Error('Item not found')
  Object.assign(found.item, meta)
  return { ...found.item }
}

export async function replaceBody(filename: string, body: string): Promise<Item> {
  const found = findItem(filename)
  if (!found) throw new Error('Item not found')
  found.item.body = body
  return { ...found.item }
}

export async function markdownifyItem(filename: string): Promise<{ file: string; body: string; tags: string[] }> {
  const found = findItem(filename)
  if (!found) throw new Error('Item not found')
  const item = found.item
  return {
    file: filename,
    body: item.body || `## ${item.title}\n\nCaptured via GTD Brain.`,
    tags: [...(item.tags ?? []), 'processed'],
  }
}

export async function getReview(_params: Record<string, string> = {}): Promise<ReviewData> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 3)
  const stale_today = state.today.filter(i => i.today_since && new Date(i.today_since) < cutoff)

  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const due_this_week = (Object.values(state).flat() as Item[]).filter(
    i => i.due && new Date(i.due) <= weekEnd,
  )

  return {
    week_stats: { stale: stale_today.length, completed: 0, dismissed: 0, due_soon: due_this_week.length },
    stale_today,
    due_this_week,
    completed_this_week: [],
  }
}

export async function undo(): Promise<{ undone: boolean }> {
  return { undone: false }
}

// No durable log in demo mode — chat history and the event log are session-only concepts here.
export async function confirmChatOp(body: {
  target_file: string
  op: string
  proposed_body?: string
  chat_ref?: string
}): Promise<{ confirmed: boolean; file: string; op: string }> {
  if (body.op === 'dismiss') takeItem(body.target_file)
  else if (body.proposed_body !== undefined) await replaceBody(body.target_file, body.proposed_body)
  return { confirmed: true, file: body.target_file, op: body.op }
}

export async function confirmItem(filename: string): Promise<{ confirmed: boolean; file: string }> {
  const found = findItem(filename)
  if (found) found.item.confirmed = true
  return { confirmed: true, file: filename }
}

export async function getChatHistory(_limit = 50): Promise<ChatHistoryEntry[]> {
  return []
}

export async function getEvents(_params: { limit?: number; actor?: string; op?: string } = {}): Promise<EventEntry[]> {
  return []
}

export async function transcribe(_audioBlob: Blob): Promise<{ text: string }> {
  return { text: '' }
}

const PROVIDERS = [
  { id: 'groq', label: 'Groq (Llama 3.3-70b)', status: 'UP' as const },
  { id: 'ollama', label: 'Ollama (local)', status: 'DOWN' as const },
]

let activeProvider = 'groq'

export async function getProviders(): Promise<ProvidersResponse> {
  return { active: activeProvider, providers: PROVIDERS }
}

export async function selectProvider(id: string): Promise<{ active: string }> {
  const found = PROVIDERS.find(p => p.id === id)
  if (!found || found.status !== 'UP') throw new Error(`Provider ${id} unavailable`)
  activeProvider = id
  return { active: activeProvider }
}

// Structural contract check: the Vite alias in vite.config.ts swaps this whole module in for
// ./api at build time, and nothing else imports both, so nothing else lets TypeScript catch a
// drift between them. If this module's exports stop matching api.ts's shape, this assignment
// fails to compile — instead of the drift only surfacing as a runtime "X is not a function"
// crash under VITE_MOCK=true.
const _contract: typeof RealApi = {
  chat, getBuckets, getBucket, getToday, fetchItem, markDone, dismissItem,
  moveItem, patchMeta, replaceBody, markdownifyItem, getReview, undo,
  confirmChatOp, confirmItem, getChatHistory, getEvents, transcribe,
  getProviders, selectProvider,
}
void _contract

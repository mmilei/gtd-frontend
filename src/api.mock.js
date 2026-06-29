// In-memory GTD state for demo/GitHub Pages deployment.
// Loaded by vite.config.js alias when VITE_MOCK=true; api.js is never touched.

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function makeFilename(title) {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15)
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `${ts}-${slug}.md`
}

const state = {
  today: [
    { filename: '20260628-090000-review-team-pull-request.md', bucket: 'today', title: 'Review team pull request', due: todayStr(), tags: ['work', 'code'], body: '', created: '2026-06-28', today_since: '2026-06-28' },
    { filename: '20260628-095500-call-the-dentist.md',         bucket: 'today', title: 'Call the dentist', due: todayStr(), tags: ['health'], body: '', created: '2026-06-28', today_since: '2026-06-28' },
  ],
  backlog: [
    { filename: '20260627-150000-write-project-readme.md', bucket: 'backlog', title: 'Write project README', tags: ['work'], body: '', created: '2026-06-27' },
  ],
  waiting: [
    { filename: '20260625-110000-wait-for-design-team.md', bucket: 'waiting', title: 'Wait for design team response', delegado_a: 'design team', tags: [], body: '', created: '2026-06-25' },
  ],
  someday: [
    { filename: '20260620-120000-learn-rust.md', bucket: 'someday', title: 'Learn Rust', tags: [], body: '', created: '2026-06-20' },
  ],
  reference: [
    {
      filename: '20260615-080000-gtd-getting-things-done.md',
      bucket: 'reference',
      title: 'GTD — Getting Things Done',
      tags: ['productivity', 'methodology'],
      body: 'Personal organization system by David Allen.\n\n- **now**: 2 min or less, do it immediately\n- **today**: pending for today\n- **backlog**: someday, no date\n- **waiting**: delegated, awaiting response\n- **someday**: maybe, no commitment\n- **reference**: information, no action required',
      created: '2026-06-15',
    },
  ],
}

const KEYWORDS = {
  today:     ['hoy', 'urgente', 'ahora', 'today', 'urgent', 'asap', 'esta tarde', 'esta mañana'],
  someday:   ['someday', 'algún día', 'algun dia', 'quizás', 'quizas', 'maybe', 'alguna vez', 'en algún momento'],
  waiting:   ['esperar', 'espero', 'delegar', 'delegá', 'waiting', 'esperando', 'cuando me confirmen', 'cuando respondan'],
  reference: ['referencia', 'ref', 'info', 'leer', 'read', 'guardar', 'nota sobre', 'apunte', 'documentación'],
}

function classify(message) {
  const lower = message.toLowerCase()
  for (const [bucket, keywords] of Object.entries(KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return bucket
  }
  return 'backlog'
}

function extractTitle(message) {
  return message.trim().replace(/[.!?]+$/, '').replace(/^./, c => c.toUpperCase()).slice(0, 80)
}

function findItem(filename) {
  for (const [bucket, items] of Object.entries(state)) {
    const idx = items.findIndex(i => i.filename === filename)
    if (idx !== -1) return { item: items[idx], bucket, idx }
  }
  return null
}

function removeItem(filename) {
  for (const bucket of Object.keys(state)) {
    const idx = state[bucket].findIndex(i => i.filename === filename)
    if (idx !== -1) { state[bucket].splice(idx, 1); return true }
  }
  return false
}

export async function chat(message) {
  const bucket = classify(message)
  const title = extractTitle(message)
  const filename = makeFilename(title)
  const item = {
    filename,
    bucket,
    title,
    tags: [],
    body: '',
    created: todayStr(),
    ...(bucket === 'today'   ? { due: todayStr(), today_since: todayStr() } : {}),
    ...(bucket === 'waiting' ? { delegado_a: '' } : {}),
  }
  state[bucket].unshift(item)
  return { fallback: false, ops: [{ op: 'create', filed: true, bucket, title, file: filename }] }
}

export async function getBuckets() {
  return Object.fromEntries(Object.entries(state).map(([k, v]) => [k, [...v]]))
}

export async function getBucket(bucket) {
  return (state[bucket] || []).map(item => ({ ...item, file: item.filename || item.file }))
}

export async function getToday() {
  return [...state.today]
}

export async function markDone(filename) {
  removeItem(filename)
  return { op: 'done', filed: true, file: filename }
}

export async function fetchItem(filename) {
  const found = findItem(filename)
  if (!found) throw new Error('Item not found')
  return { ...found.item }
}

export async function patchMeta(filename, meta) {
  const found = findItem(filename)
  if (!found) throw new Error('Item not found')
  Object.assign(found.item, meta)
  return { ...found.item }
}

export async function replaceBody(filename, body) {
  const found = findItem(filename)
  if (!found) throw new Error('Item not found')
  found.item.body = body
  return { ...found.item }
}

export async function transcribe(_audioBlob) {
  return { text: '' }
}

export async function markdownifyItem(filename) {
  const found = findItem(filename)
  if (!found) throw new Error('Item not found')
  const item = found.item
  return {
    file: filename,
    body: item.body || `## ${item.title}\n\nCapturado via GTD Brain.`,
    tags: [...(item.tags || []), 'procesado'],
  }
}

export async function getReview(_params = {}) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 3)

  const stale_today = state.today.filter(i => i.today_since && new Date(i.today_since) < cutoff)

  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const due_this_week = Object.values(state)
    .flat()
    .filter(i => i.due && new Date(i.due) <= weekEnd)

  return {
    week_stats: { completed: 0, dismissed: 0 },
    stale_today,
    due_this_week,
    completed_this_week: [],
  }
}

export async function moveItem(filename, bucket, due = null) {
  const found = findItem(filename)
  if (!found) throw new Error('Item not found')
  removeItem(filename)
  const item = { ...found.item, bucket }
  if (due) item.due = due
  if (bucket === 'today' && !item.today_since) item.today_since = todayStr()
  state[bucket].unshift(item)
  return { op: 'move', filed: true, file: filename, bucket }
}

export async function dismissItem(filename) {
  removeItem(filename)
  return { op: 'dismiss', filed: false, file: filename }
}

export async function ping() {
  return true
}

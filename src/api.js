const BASE = '/api'

export async function chat(message) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() // array of op results
}

export async function getBuckets() {
  const res = await fetch(`${BASE}/buckets`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() // { today, backlog, waiting, someday }
}

export async function getToday() {
  const res = await fetch(`${BASE}/today`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function markDone(filename) {
  const res = await fetch(`${BASE}/items/${encodeURIComponent(filename)}/done`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchItem(filename) {
  const res = await fetch(`${BASE}/items/${encodeURIComponent(filename)}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function replaceBody(filename, body) {
  const res = await fetch(`${BASE}/items/${encodeURIComponent(filename)}/body`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function transcribe(audioBlob) {
  const form = new FormData()
  form.append('audio', audioBlob, 'recording.webm')
  const res = await fetch(`${BASE}/transcribe`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() // { text }
}

export async function ping() {
  try {
    const res = await fetch(`${BASE}/buckets`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

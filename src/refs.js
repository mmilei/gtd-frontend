import { getBuckets } from './api.js'
import { openModal } from './modal.js'

let panelOpen = false
let allItems  = []

export function initRefsPanel() {
  const btn      = document.getElementById('refs-btn')
  const closeBtn = document.getElementById('refs-close')
  const search   = document.getElementById('refs-search')

  btn.addEventListener('click', togglePanel)
  closeBtn.addEventListener('click', closePanel)

  search.addEventListener('input', () => renderRefs(search.value.trim()))

  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea')) return
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); togglePanel() }
    if (e.key === 'Escape' && panelOpen) closePanel()
  })
}

export async function refreshIfOpen() {
  if (!panelOpen) return
  await loadAndRender()
}

function togglePanel() {
  panelOpen ? closePanel() : openPanel()
}

async function openPanel() {
  panelOpen = true
  document.getElementById('refs-panel').classList.add('open')
  document.getElementById('refs-btn').classList.add('active')
  document.getElementById('refs-search').value = ''
  await loadAndRender()
  document.getElementById('refs-search').focus()
}

function closePanel() {
  panelOpen = false
  document.getElementById('refs-panel').classList.remove('open')
  document.getElementById('refs-btn').classList.remove('active')
}

async function loadAndRender() {
  const body = document.getElementById('refs-body')
  body.innerHTML = '<div class="refs-empty">Cargando…</div>'
  try {
    const data = await getBuckets()
    allItems = data.reference || []
    renderRefs(document.getElementById('refs-search').value.trim())
  } catch {
    body.innerHTML = '<div class="refs-empty">No se pudo conectar al backend.</div>'
  }
}

function renderRefs(query = '') {
  const body = document.getElementById('refs-body')

  const q = query.toLowerCase()
  const items = q
    ? allItems.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.body  || '').toLowerCase().includes(q)
      )
    : allItems

  if (items.length === 0) {
    body.innerHTML = `<div class="refs-empty">${q ? 'Sin resultados.' : 'Sin referencias.'}</div>`
    return
  }

  // Group by first non-system tag
  const groups = {}
  for (const item of items) {
    const tags  = (item.tags || []).filter(t => t !== 'gtd' && t !== 'reference')
    const group = tags[0] || '—'
    if (!groups[group]) groups[group] = []
    groups[group].push(item)
  }

  const sorted = Object.entries(groups).sort(([a], [b]) =>
    a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)
  )

  body.innerHTML = sorted.map(([group, groupItems]) => `
    <div class="refs-group-label">${escHtml(group)}</div>
    ${groupItems.map(item => refCard(item)).join('')}
  `).join('')

  body.querySelectorAll('.ref-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.file))
  })
}

function refCard(item) {
  const tags = (item.tags || []).filter(t => t !== 'gtd' && t !== 'reference')
  const body = (item.body || '').replace(/^#+\s.*/gm, '').trim()

  return `
    <div class="ref-card" data-file="${escAttr(item.file)}">
      <div class="ref-card-title">${escHtml(item.title || item.file || '—')}</div>
      ${body ? `<div class="ref-card-body">${escHtml(body)}</div>` : ''}
      <div class="ref-card-footer">
        <span class="ref-card-date">${escHtml(item.created || '')}</span>
        ${tags.length ? `<div class="ref-card-tags">${tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
      </div>
    </div>
  `
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function escAttr(s) {
  return String(s ?? '').replace(/"/g,'&quot;')
}

import { getBuckets, getToday, markDone } from './api.js'
import { openModal, updateTagSuggestions } from './modal.js'

const BUCKET_META = {
  today:     { label: 'Today',   color: 'var(--today)',     icon: '⚡' },
  backlog:   { label: 'Backlog', color: 'var(--backlog)',   icon: '📋' },
  waiting:   { label: 'Waiting', color: 'var(--waiting)',   icon: '⏳' },
  someday:   { label: 'Someday', color: 'var(--someday)',   icon: '🌱' },
  reference: { label: 'Ref',     color: 'var(--reference)', icon: '📚' },
}

let currentBucket = 'today'
let bucketData    = {}
let selectedTag   = null

export function initSidebar() {
  const tabs = document.querySelectorAll('.tab-btn')
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'))
      btn.classList.add('active')
      currentBucket = btn.dataset.bucket
      selectedTag   = null
      renderTagBar()
      renderItems()
    })
  })
}

export async function refreshBuckets() {
  try {
    const [all, today] = await Promise.all([getBuckets(), getToday()])
    bucketData = { ...all, today }
    updateTagSuggestions(Object.values(bucketData).flat())
    renderCounts()
    renderTagBar()
    renderItems()
  } catch {
    // silently ignore — API might not be running yet
  }
}

function renderTagBar() {
  const el    = document.getElementById('tag-bar')
  const items = bucketData[currentBucket] || []

  const SYSTEM_TAGS = new Set(['gtd', 'action', 'reference', 'project'])
  const tally = {}
  for (const item of items) {
    const tags = Array.isArray(item.tags) ? item.tags.filter(t => !SYSTEM_TAGS.has(t)) : []
    for (const t of tags) tally[t] = (tally[t] || 0) + 1
  }

  const tags = Object.entries(tally).sort((a, b) => b[1] - a[1])
  if (tags.length === 0) { el.innerHTML = ''; return }

  el.innerHTML = tags.map(([tag, count]) => `
    <button class="tag-filter-pill${selectedTag === tag ? ' active' : ''}" data-tag="${escAttr(tag)}">
      ${escHtml(tag)} <span class="tpill-count">${count}</span>
    </button>
  `).join('')

  el.querySelectorAll('.tag-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      selectedTag = selectedTag === pill.dataset.tag ? null : pill.dataset.tag
      renderTagBar()
      renderItems()
    })
  })
}

function renderCounts() {
  const el = document.getElementById('bucket-counts')
  const order = ['today', 'backlog', 'waiting', 'someday']
  el.innerHTML = order.map(b => {
    const meta = BUCKET_META[b]
    const count = (bucketData[b] || []).length
    return `<span class="count-chip" style="color:${meta.color}" data-bucket="${b}" title="${meta.label}">
      ${meta.icon} ${count}
    </span>`
  }).join('')

  el.querySelectorAll('.count-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => {
        t.classList.toggle('active', t.dataset.bucket === chip.dataset.bucket)
      })
      currentBucket = chip.dataset.bucket
      renderItems()
    })
  })
}

function renderItems() {
  const el  = document.getElementById('items-list')
  const all = bucketData[currentBucket] || []

  const items = selectedTag
    ? all.filter(i => Array.isArray(i.tags) && i.tags.includes(selectedTag))
    : all

  if (items.length === 0) {
    el.innerHTML = `<div class="empty-state"><p>${selectedTag ? `No items with #${escHtml(selectedTag)}` : 'No items'}</p></div>`
    return
  }

  const meta = BUCKET_META[currentBucket] || {}
  el.innerHTML = items.map(item => itemCard(item, meta)).join('')

  el.querySelectorAll('.done-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const filename = btn.dataset.file
      btn.classList.add('completing')
      btn.innerHTML = checkSVG()
      try {
        await markDone(filename)
        playBoink()
        const card = btn.closest('.item-card')
        card.classList.add('boinking')
        setTimeout(() => {
          bucketData[currentBucket] = (bucketData[currentBucket] || []).filter(i => i.file !== filename)
          if (currentBucket === 'today') {
            bucketData.today = (bucketData.today || []).filter(i => i.file !== filename)
          }
          renderCounts()
          renderItems()
        }, 280)
      } catch {
        btn.classList.remove('completing')
        btn.innerHTML = circleSVG()
      }
    })
  })

  el.querySelectorAll('.item-card[data-file]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.done-btn')) return
      openModal(card.dataset.file)
    })
  })
}

function itemCard(item, meta) {
  const color    = meta.color || 'var(--muted)'
  const due      = item.due ? `· ${item.due}` : ''
  const delegado = item.delegado_a ? `· @${item.delegado_a}` : ''
  const SYSTEM   = new Set(['gtd', 'action', 'reference', 'project'])
  const tags     = Array.isArray(item.tags) ? item.tags.filter(t => !SYSTEM.has(t)) : []
  const snippet  = bodySnippet(item.body)
  const ageBadge = ageBadgeHtml(item)

  return `
    <div class="item-card bc-${item.bucket || currentBucket}" style="--bucket-color:${color}" data-file="${escAttr(item.file)}">
      <div class="item-title">${escHtml(item.title || item.file || '—')}</div>
      <div class="item-meta">
        <span>${escHtml(item.created || '')}</span>
        ${due      ? `<span>${escHtml(due)}</span>`      : ''}
        ${delegado ? `<span>${escHtml(delegado)}</span>` : ''}
        ${ageBadge}
      </div>
      ${snippet ? `<div class="item-preview">${escHtml(snippet)}</div>` : ''}
      ${tags.length ? `<div class="item-tags">${tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
      <button class="done-btn" data-file="${escAttr(item.file)}" title="Mark as done">
        ${circleSVG()}
      </button>
    </div>
  `
}

function ageBadgeHtml(item) {
  if (currentBucket !== 'today' || !item.today_since) return ''
  const days = Math.floor((Date.now() - new Date(item.today_since)) / 86400000)
  if (days < 2) return ''
  const cls = days >= 3 ? 'age-stale' : 'age-warning'
  return `<span class="age-badge ${cls}">${days}d</span>`
}

function bodySnippet(body) {
  if (!body) return ''
  const line = body.split('\n').find(l => l.trim() && !/^#+\s/.test(l) && !/^[-*]\s/.test(l))
  if (!line) return ''
  const t = line.trim()
  return t.slice(0, 80) + (t.length > 80 ? '…' : '')
}

function playBoink() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
  } catch { /* silencio si el browser bloquea AudioContext */ }
}

function circleSVG() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`
}
function checkSVG() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function escAttr(s) {
  return String(s).replace(/"/g,'&quot;')
}

export { BUCKET_META }

import { getBuckets, getToday, markDone } from './api.js'

const BUCKET_META = {
  today:     { label: 'Hoy',     color: 'var(--today)',     icon: '⚡' },
  backlog:   { label: 'Backlog', color: 'var(--backlog)',   icon: '📋' },
  waiting:   { label: 'Waiting', color: 'var(--waiting)',   icon: '⏳' },
  someday:   { label: 'Someday', color: 'var(--someday)',   icon: '🌱' },
  reference: { label: 'Ref',     color: 'var(--reference)', icon: '📚' },
}

let currentBucket = 'today'
let bucketData = {}

export function initSidebar() {
  const tabs = document.querySelectorAll('.tab-btn')
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'))
      btn.classList.add('active')
      currentBucket = btn.dataset.bucket
      renderItems()
    })
  })
}

export async function refreshBuckets() {
  try {
    const [all, today] = await Promise.all([getBuckets(), getToday()])
    bucketData = { ...all, today }
    renderCounts()
    renderItems()
  } catch {
    // silently ignore — API might not be running yet
  }
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
  const el = document.getElementById('items-list')
  const items = bucketData[currentBucket] || []

  if (items.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>Sin ítems</p></div>'
    return
  }

  const meta = BUCKET_META[currentBucket] || {}
  el.innerHTML = items.map(item => itemCard(item, meta)).join('')

  el.querySelectorAll('.done-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const filename = btn.dataset.file
      btn.classList.add('completing')
      btn.innerHTML = checkSVG()
      try {
        await markDone(filename)
        const card = btn.closest('.item-card')
        card.style.transition = 'opacity 0.3s, transform 0.3s'
        card.style.opacity = '0'
        card.style.transform = 'translateX(20px)'
        setTimeout(() => {
          bucketData[currentBucket] = (bucketData[currentBucket] || []).filter(i => i.file !== filename)
          if (currentBucket === 'today') {
            bucketData.today = (bucketData.today || []).filter(i => i.file !== filename)
          }
          renderCounts()
          renderItems()
        }, 300)
      } catch {
        btn.classList.remove('completing')
        btn.innerHTML = circleSVG()
      }
    })
  })
}

function itemCard(item, meta) {
  const color    = meta.color || 'var(--muted)'
  const due      = item.due ? `· ${item.due}` : ''
  const delegado = item.delegado_a ? `· @${item.delegado_a}` : ''
  const tags     = Array.isArray(item.tags) ? item.tags.filter(t => t !== 'gtd') : []

  return `
    <div class="item-card bc-${item.bucket || currentBucket}" style="--bucket-color:${color}">
      <div class="item-title">${escHtml(item.title || item.file || '—')}</div>
      <div class="item-meta">
        <span>${escHtml(item.created || '')}</span>
        ${due      ? `<span>${escHtml(due)}</span>`      : ''}
        ${delegado ? `<span>${escHtml(delegado)}</span>` : ''}
      </div>
      ${tags.length ? `<div class="item-tags">${tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
      <button class="done-btn" data-file="${escAttr(item.file)}" title="Marcar como hecho">
        ${circleSVG()}
      </button>
    </div>
  `
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

import { getReview, markDone, dismissItem, moveItem } from './api.js'

let onRefreshCallback = null

export function initReview(onRefresh) {
  onRefreshCallback = onRefresh

  const panel = document.createElement('div')
  panel.id        = 'review-panel'
  panel.className = 'review-panel hidden'
  panel.innerHTML = `
    <div class="review-header">
      <span class="review-title">Weekly Review</span>
      <button id="review-refresh" class="review-refresh-btn" title="Refresh">↻</button>
      <button id="review-close" class="review-close-btn" title="Close">✕</button>
    </div>
    <div id="review-stats" class="review-stats"></div>
    <div id="review-body" class="review-body">
      <div class="review-loading">Loading…</div>
    </div>
  `
  document.body.appendChild(panel)

  document.getElementById('review-close').addEventListener('click', closeReview)
  document.getElementById('review-refresh').addEventListener('click', loadReview)

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.classList.contains('hidden')) closeReview()
  })
}

export function openReview() {
  document.getElementById('review-panel').classList.remove('hidden')
  loadReview()
}

function closeReview() {
  document.getElementById('review-panel').classList.add('hidden')
}

async function loadReview() {
  const body  = document.getElementById('review-body')
  const stats = document.getElementById('review-stats')
  body.innerHTML  = '<div class="review-loading">Cargando…</div>'
  stats.innerHTML = ''

  try {
    const data = await getReview()
    renderStats(stats, data.week_stats)
    body.innerHTML = ''
    renderSection(body, 'Stale (3+ days in Today)', data.stale_today,   'stale',     true)
    renderSection(body, 'Due this week',             data.due_this_week, 'due-soon',  false)
    renderSection(body, 'Completed this week',       data.completed_this_week, 'done-week', false)
  } catch (e) {
    body.innerHTML = `<div class="review-error">Failed to load: ${e.message}</div>`
  }
}

function renderStats(container, stats) {
  if (!stats) return
  container.innerHTML = `
    <span class="stat-chip stale-chip">${stats.stale} stale</span>
    <span class="stat-chip done-chip">${stats.completed} completed</span>
    <span class="stat-chip due-chip">${stats.due_soon} due soon</span>
  `
}

function renderSection(container, title, items, cls, withActions) {
  const section = document.createElement('div')
  section.className = `review-section review-section--${cls}`

  const heading = document.createElement('div')
  heading.className = 'review-section-title'
  heading.textContent = `${title} (${items.length})`
  section.appendChild(heading)

  if (!items.length) {
    const empty = document.createElement('div')
    empty.className = 'review-empty'
    empty.textContent = 'None'
    section.appendChild(empty)
    container.appendChild(section)
    return
  }

  items.forEach(item => {
    const row = document.createElement('div')
    row.className = 'review-item'
    row.innerHTML = `
      <span class="review-item-title">${escHtml(item.title || item.file)}</span>
      ${item.due ? `<span class="review-item-due">${item.due}</span>` : ''}
    `

    if (withActions) {
      const actions = document.createElement('div')
      actions.className = 'review-item-actions'
      actions.innerHTML = `
        <button class="review-action-btn" data-action="backlog" data-file="${escAttr(item.file)}">Backlog</button>
        <button class="review-action-btn" data-action="someday" data-file="${escAttr(item.file)}">Someday</button>
        <button class="review-action-btn btn-done"    data-action="done"    data-file="${escAttr(item.file)}">Done</button>
        <button class="review-action-btn btn-dismiss" data-action="dismiss" data-file="${escAttr(item.file)}">Dismiss</button>
      `
      actions.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.file, row))
      })
      row.appendChild(actions)
    }

    section.appendChild(row)
  })

  container.appendChild(section)
}

async function handleAction(action, file, row) {
  row.style.opacity = '0.4'
  row.style.pointerEvents = 'none'
  try {
    if (action === 'done')    await markDone(file)
    else if (action === 'dismiss') await dismissItem(file)
    else                      await moveItem(file, action)
    row.remove()
    if (onRefreshCallback) onRefreshCallback()
  } catch {
    row.style.opacity = ''
    row.style.pointerEvents = ''
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function escAttr(s) {
  return String(s).replace(/"/g,'&quot;')
}

import { getBucket, moveItem, dismissItem } from './api.js'
import { refreshBuckets } from './buckets.js'

let overlay = null
let queue = []
let currentIndex = 0

export function initTriage() {
  overlay = document.createElement('div')
  overlay.className = 'triage-overlay hidden'
  overlay.innerHTML = `
    <div class="triage-box">
      <div class="triage-header">
        <span class="triage-progress"></span>
        <button class="triage-close-btn">✕ Close</button>
      </div>
      <div class="triage-item">
        <div class="triage-title"></div>
        <div class="triage-meta"></div>
        <div class="triage-body"></div>
        <div class="triage-tags"></div>
      </div>
      <div class="triage-actions">
        <button data-action="today">⚡ Today</button>
        <button data-action="backlog">📋 Skip</button>
        <button data-action="someday">🌱 Someday</button>
        <button data-action="dismiss">✕ Dismiss</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.querySelector('.triage-close-btn').addEventListener('click', closeTriage)
  overlay.querySelectorAll('.triage-actions [data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action))
  })
}

export async function openTriage() {
  let items
  try {
    items = await getBucket('backlog')
  } catch (err) {
    console.error('Triage: failed to load backlog', err)
    return
  }
  queue = items || []
  currentIndex = 0
  overlay.classList.remove('hidden')
  if (queue.length === 0) {
    showMessage('Empty backlog ✓')
  } else {
    restoreActions()
    showItem(0)
  }
}

function closeTriage() {
  overlay.classList.add('hidden')
  queue = []
  refreshBuckets()
}

function showItem(index) {
  if (index >= queue.length) {
    showMessage('✓ Inbox cleared')
    return
  }
  const item = queue[index]
  overlay.querySelector('.triage-progress').textContent = `${index + 1} / ${queue.length}`
  overlay.querySelector('.triage-title').textContent = item.title || item.file

  const parts = []
  if (item.created) parts.push(item.created)
  if (item.due) parts.push(`due: ${item.due}`)
  if (item.delegado_a) parts.push(`→ ${item.delegado_a}`)
  overlay.querySelector('.triage-meta').textContent = parts.join(' · ')

  const body = (item.body || '').trim()
  const bodyEl = overlay.querySelector('.triage-body')
  bodyEl.textContent = body ? (body.length > 150 ? body.slice(0, 150) + '…' : body) : ''
  bodyEl.style.display = body ? '' : 'none'

  const tags = (item.tags || []).filter(t => t !== 'gtd' && t !== 'action')
  overlay.querySelector('.triage-tags').innerHTML =
    tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')
}

async function handleAction(action) {
  if (currentIndex >= queue.length) return
  const item = queue[currentIndex]
  const btns = overlay.querySelectorAll('.triage-actions button')
  btns.forEach(b => b.disabled = true)
  try {
    if (action === 'dismiss') {
      await dismissItem(item.file)
    } else {
      await moveItem(item.file, action)
    }
    currentIndex++
    showItem(currentIndex)
  } catch (err) {
    console.error('Triage action failed:', err)
  } finally {
    btns.forEach(b => b.disabled = false)
  }
}

function showMessage(msg) {
  overlay.querySelector('.triage-item').innerHTML = `<div class="triage-done">${msg}</div>`
  overlay.querySelector('.triage-actions').style.display = 'none'
  setTimeout(() => { closeTriage(); restoreActions() }, 1500)
}

function restoreActions() {
  overlay.querySelector('.triage-actions').style.display = ''
  overlay.querySelector('.triage-item').innerHTML = `
    <div class="triage-title"></div>
    <div class="triage-meta"></div>
    <div class="triage-body"></div>
    <div class="triage-tags"></div>
  `
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

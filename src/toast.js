import { moveItem, dismissItem } from './api.js'
import { refreshBuckets } from './buckets.js'

const BUCKET_META = {
  today:     { icon: '⚡', color: 'var(--today)' },
  backlog:   { icon: '📋', color: 'var(--backlog)' },
  waiting:   { icon: '⏳', color: 'var(--waiting)' },
  someday:   { icon: '🌱', color: 'var(--someday)' },
  reference: { icon: '📚', color: 'var(--reference)' },
  now:       { icon: '⚡', color: 'var(--now)' },
}

let toastEl = null
let dismissTimer = null
let currentFile = null
let toastQueue = []
let toastActive = false

export function initToast() {
  toastEl = document.createElement('div')
  toastEl.className = 'toast hidden'
  toastEl.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon"></span>
      <span class="toast-title"></span>
      <button class="toast-adjust">Ajustar ▾</button>
    </div>
    <div class="toast-actions hidden">
      <button data-action="today">⚡ Hoy</button>
      <button data-action="backlog">📋 Backlog</button>
      <button data-action="someday">🌱 Someday</button>
      <button data-action="dismiss">✕ Descartar</button>
    </div>
    <div class="toast-bar"></div>
  `
  document.body.appendChild(toastEl)

  toastEl.querySelector('.toast-adjust').addEventListener('click', () => {
    clearTimeout(dismissTimer)
    toastEl.querySelector('.toast-actions').classList.toggle('hidden')
    toastEl.querySelector('.toast-bar').style.animationPlayState = 'paused'
  })

  toastEl.querySelectorAll('.toast-actions [data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!currentFile) return
      btn.disabled = true
      try {
        if (btn.dataset.action === 'dismiss') {
          await dismissItem(currentFile)
        } else {
          await moveItem(currentFile, btn.dataset.action)
        }
        hideToast()
        await refreshBuckets()
      } catch (err) {
        console.error('Toast action failed:', err)
        btn.disabled = false
      }
    })
  })
}

export function showToast(op) {
  if (op.op !== 'create' || !op.file || !op.filed) return
  toastQueue.push(op)
  if (!toastActive) drainQueue()
}

function drainQueue() {
  if (toastQueue.length === 0) { toastActive = false; return }
  toastActive = true
  displayToast(toastQueue.shift(), drainQueue)
}

function displayToast(op, onDone) {
  if (!toastEl) return
  currentFile = op.file
  const meta = BUCKET_META[op.bucket] || { icon: '📌', color: 'var(--muted)' }

  toastEl.querySelector('.toast-icon').textContent = meta.icon
  toastEl.querySelector('.toast-title').textContent = op.title || op.file
  toastEl.querySelector('.toast-actions').classList.add('hidden')
  toastEl.querySelectorAll('.toast-actions button').forEach(b => b.disabled = false)

  const bar = toastEl.querySelector('.toast-bar')
  bar.style.background = meta.color
  bar.style.animation = 'none'
  bar.offsetHeight // force reflow to restart animation
  bar.style.animation = 'toast-shrink 3s linear forwards'

  toastEl.classList.remove('hidden')

  clearTimeout(dismissTimer)
  dismissTimer = setTimeout(() => {
    hideToast()
    onDone()
  }, 3200)
}

function hideToast() {
  if (toastEl) toastEl.classList.add('hidden')
  currentFile = null
  clearTimeout(dismissTimer)
}

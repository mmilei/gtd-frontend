import { initScene } from './scene.js'
import { chat, ping, transcribe } from './api.js'
import { initSidebar, refreshBuckets, BUCKET_META } from './buckets.js'
import { initModal } from './modal.js'
import { initRefsPanel, refreshIfOpen } from './refs.js'

// ─── Init Three.js background ──────────────────────────────
const canvas = document.getElementById('bg-canvas')
const { pulse } = initScene(canvas)

// ─── Init sidebar ───────────────────────────────────────────
initSidebar()
initModal(refreshBuckets)
initRefsPanel()

// ─── API health check ───────────────────────────────────────
const statusDot   = document.getElementById('api-status')
const statusLabel = document.getElementById('api-label')

async function checkApi() {
  statusDot.className = 'status-dot loading'
  statusLabel.textContent = 'conectando…'
  const ok = await ping()
  if (ok) {
    statusDot.className = 'status-dot online'
    statusLabel.textContent = 'API online'
    await refreshBuckets()
  } else {
    statusDot.className = 'status-dot offline'
    statusLabel.textContent = 'API offline'
  }
}

checkApi()
setInterval(checkApi, 30_000)

// ─── Chat state ─────────────────────────────────────────────
const messagesEl = document.getElementById('messages')
const inputEl    = document.getElementById('chat-input')
const sendBtn    = document.getElementById('send-btn')

// Welcome card
messagesEl.innerHTML = `
  <div class="welcome-msg">
    <h2>GTD Brain</h2>
    <p>Escribí cualquier cosa: una tarea, un pensamiento, algo para delegar.<br>
    El modelo lo clasifica y archiva en tu vault de Obsidian.</p>
  </div>
`

// Auto-resize textarea
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto'
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px'
})

// Send on Enter (Shift+Enter = newline)
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
})
sendBtn.addEventListener('click', sendMessage)

// ─── Send message ───────────────────────────────────────────
async function sendMessage() {
  const text = inputEl.value.trim()
  if (!text) return

  inputEl.value = ''
  inputEl.style.height = 'auto'
  sendBtn.disabled = true

  appendUserBubble(text)
  const typingEl = appendTyping()
  scrollToBottom()

  try {
    const { fallback, ops } = await chat(text)
    typingEl.remove()
    appendApiResponse(ops, fallback)
    pulse() // Three.js particle burst
    await refreshBuckets()
    await refreshIfOpen()

    // Update status
    statusDot.className = 'status-dot online'
    statusLabel.textContent = 'API online'
  } catch (err) {
    typingEl.remove()
    appendError(err.message)
    statusDot.className = 'status-dot offline'
    statusLabel.textContent = 'API offline'
  } finally {
    sendBtn.disabled = false
    inputEl.focus()
    scrollToBottom()
  }
}

// ─── Message rendering ───────────────────────────────────────
function appendUserBubble(text) {
  const el = document.createElement('div')
  el.className = 'msg-user'
  el.innerHTML = `<div class="bubble">${escHtml(text)}</div>`
  messagesEl.appendChild(el)
}

function appendTyping() {
  const el = document.createElement('div')
  el.className = 'typing-indicator'
  el.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`
  messagesEl.appendChild(el)
  return el
}

function appendApiResponse(ops, fallback) {
  const wrap = document.createElement('div')
  wrap.className = 'msg-api'
  wrap.innerHTML = `<div class="api-label">GTD Brain${fallback ? ' <span style="font-size:10px;opacity:0.5">(fallback)</span>' : ''}</div>`

  for (const op of (ops || [])) {
    wrap.appendChild(buildOpCard(op))
  }
  messagesEl.appendChild(wrap)
}

function buildOpCard(op) {
  const el = document.createElement('div')
  el.className = 'op-card'

  const bucket = op.bucket || ''
  const meta   = BUCKET_META[bucket] || {}
  const color  = meta.color || 'var(--muted)'
  const icon   = resolveIcon(op)

  const iconBg = op.filed === false ? 'rgba(239,68,68,0.15)' : `rgba(99,102,241,0.15)`

  let details = ''
  if (op.filed && op.file) {
    details = `<div class="op-file">📄 ${escHtml(op.file)}</div>`
  }
  if (op.appended) {
    details += `<div class="op-file" style="color:var(--someday)">+ ${escHtml(op.appended)}</div>`
  }
  if (op.error) {
    details = `<div class="op-error">⚠ ${escHtml(op.error)}</div>`
  }
  if (op.message && !op.filed) {
    details = `<div class="op-file" style="color:var(--waiting)">${escHtml(op.message)}</div>`
  }

  const badgeHtml = bucket
    ? `<span class="bucket-badge" style="background:${color}22;color:${color}">${escHtml(bucket)}</span>`
    : ''

  el.innerHTML = `
    <div class="op-icon" style="background:${iconBg}">${icon}</div>
    <div class="op-content">
      <div class="op-top">
        <span class="op-type">${escHtml(op.op || 'op')}</span>
        ${badgeHtml}
        ${op.filed ? '<span style="font-size:11px;color:var(--now)">✓ archivado</span>' : '<span style="font-size:11px;color:var(--discard)">✗ no archivado</span>'}
      </div>
      ${details}
    </div>
  `
  return el
}

function appendError(msg) {
  const el = document.createElement('div')
  el.className = 'msg-api'
  el.innerHTML = `
    <div class="api-label">Error</div>
    <div class="op-card">
      <div class="op-icon" style="background:rgba(239,68,68,0.15)">⚠️</div>
      <div class="op-content">
        <div class="op-error">${escHtml(msg)}</div>
        <div class="op-file">¿El servidor Java está corriendo en :8080?</div>
      </div>
    </div>
  `
  messagesEl.appendChild(el)
}

function resolveIcon(op) {
  if (op.op === 'done')   return '✅'
  if (op.op === 'update') return '✏️'
  if (!op.filed)          return '🗑️'
  const icons = { today:'⚡', backlog:'📋', waiting:'⏳', someday:'🌱', reference:'📚', now:'⚡', discard:'🗑️' }
  return icons[op.bucket] || '📌'
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight
}

// ─── Voice input ────────────────────────────────────────────
const micBtn = document.getElementById('mic-btn')
let mediaRecorder = null
let audioChunks = []
let micState = 'idle' // idle | recording | transcribing

function setMicState(state) {
  micState = state
  micBtn.dataset.state = state
  micBtn.disabled = state === 'transcribing'
}

micBtn.addEventListener('click', async () => {
  if (micState === 'idle') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunks = []
      mediaRecorder = new MediaRecorder(stream)
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setMicState('transcribing')
        try {
          const blob = new Blob(audioChunks, { type: 'audio/webm' })
          const { text } = await transcribe(blob)
          if (text?.trim()) {
            inputEl.value = text.trim()
            inputEl.style.height = 'auto'
            inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px'
            inputEl.focus()
            pulse()
          }
        } catch (err) {
          appendError('Transcripción fallida: ' + err.message)
        } finally {
          setMicState('idle')
        }
      }
      mediaRecorder.start()
      setMicState('recording')
    } catch {
      appendError('No se pudo acceder al micrófono.')
    }
  } else if (micState === 'recording') {
    mediaRecorder.stop()
  }
})

// Focus input on load
inputEl.focus()

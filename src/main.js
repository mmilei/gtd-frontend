import { initScene } from './scene.js'
import { chat, ping, transcribe, replaceBody, dismissItem } from './api.js'
import { initSidebar, refreshBuckets, BUCKET_META } from './buckets.js'
import { initModal, openModal } from './modal.js'
import { initRefsPanel, refreshIfOpen } from './refs.js'
import { initReview, openReview } from './review.js'
import { initTriage, openTriage } from './triage.js'
import { initToast, showToast } from './toast.js'
import { initProviderMenu } from './providers.js'

// ─── Init Three.js background ──────────────────────────────
const canvas = document.getElementById('bg-canvas')
const { pulse } = initScene(canvas)

// ─── Init sidebar ───────────────────────────────────────────
initSidebar()
initModal(refreshBuckets)
initRefsPanel()
initReview(refreshBuckets)
initTriage()
initToast()
initProviderMenu()

document.getElementById('review-btn').addEventListener('click', openReview)
document.getElementById('triage-btn').addEventListener('click', openTriage)

// ─── API health check ───────────────────────────────────────
const statusDot   = document.getElementById('api-status')
const statusLabel = document.getElementById('api-label')

async function checkApi() {
  statusDot.className = 'status-dot loading'
  statusLabel.textContent = 'connecting…'
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

if (import.meta.env.VITE_MOCK === 'true') {
  const banner = document.createElement('div')
  banner.className = 'demo-banner'
  banner.textContent = 'Demo mode — data is fictional and resets on reload'
  document.getElementById('header').appendChild(banner)
}

// ─── Chat state ─────────────────────────────────────────────
const messagesEl = document.getElementById('messages')
const inputEl    = document.getElementById('chat-input')
const sendBtn    = document.getElementById('send-btn')

// Welcome card
messagesEl.innerHTML = `
  <div class="welcome-msg">
    <h2>GTD Brain</h2>
    <p>Type anything: a task, a thought, something to delegate.<br>
    The model classifies and archives it in your Obsidian vault.</p>
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
  if (micState === 'recording') {
    pendingSend = true
    if (recognition) { recognition.stop(); recognition = null }
    mediaRecorder.stop()
    return
  }
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

  if (!ops || ops.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'op-card'
    empty.innerHTML = `<div class="op-content"><div class="op-error">No encontré nada para archivar — ¿podés reformular?</div></div>`
    wrap.appendChild(empty)
  } else {
    for (const op of ops) {
      wrap.appendChild(buildOpCard(op))
      showToast(op)
    }
  }
  messagesEl.appendChild(wrap)
}

function buildConfirmCard(op) {
  const isDismiss = op.op === 'dismiss'
  const el = document.createElement('div')
  el.className = 'op-card op-card-confirm'

  const bodyHtml = isDismiss
    ? `<div class="op-confirm-warning">Descartar "${escHtml(op.title || op.target_file)}"? No se puede deshacer desde el chat.</div>`
    : `
    <div class="op-diff">
      <div class="op-diff-block op-diff-current">
        <div class="op-diff-label">Current</div>
        <pre class="op-diff-body">${escHtml(op.current_body || '(empty)')}</pre>
      </div>
      <div class="op-diff-block op-diff-proposed">
        <div class="op-diff-label">Proposed</div>
        <pre class="op-diff-body">${escHtml(op.proposed_body || '(empty)')}</pre>
      </div>
    </div>`

  el.innerHTML = `
    <div class="op-confirm-header">
      <span class="op-icon" style="background:${isDismiss ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)'}">${isDismiss ? '🗑️' : '✏️'}</span>
      <div class="op-content">
        <div class="op-top">
          <span class="op-type">${isDismiss ? 'dismiss' : 'edit'}</span>
          <span style="font-size:11px;color:var(--waiting)">awaiting confirmation</span>
        </div>
        <div class="op-file">📄 ${escHtml(op.title || op.target_file)}</div>
      </div>
    </div>
    ${bodyHtml}
    <div class="op-confirm-actions">
      <button class="confirm-btn">✓ Confirm</button>
      <button class="cancel-btn">✕ Cancel</button>
    </div>
  `
  let resolved = false
  const confirmBtn = el.querySelector('.confirm-btn')
  const cancelBtn = el.querySelector('.cancel-btn')

  function resolveCard(html) {
    el.className = 'op-card'
    el.style.opacity = '0.6'
    el.innerHTML = html
  }

  confirmBtn.addEventListener('click', async () => {
    if (resolved) return
    confirmBtn.disabled = true
    cancelBtn.disabled = true
    confirmBtn.textContent = 'Aplicando…'
    try {
      if (isDismiss) {
        await dismissItem(op.target_file)
        resolved = true
        resolveCard(`✓ Descartada — ${escHtml(op.title || op.target_file)}`)
      } else {
        await replaceBody(op.target_file, op.proposed_body)
        resolved = true
        resolveCard(`✓ Cambios aplicados — ${escHtml(op.title || op.target_file)}`)
      }
      await refreshBuckets()
    } catch {
      confirmBtn.disabled = false
      cancelBtn.disabled = false
      confirmBtn.textContent = '✓ Confirm'
    }
  })
  cancelBtn.addEventListener('click', () => {
    if (resolved) return
    resolved = true
    resolveCard('✕ Cancelado — sin cambios')
  })
  return el
}

function buildOpCard(op) {
  if (op.requires_confirmation) return buildConfirmCard(op)

  const el = document.createElement('div')
  el.className = 'op-card'

  if (op.op === 'create' && op.file && op.filed) {
    el.dataset.file = op.file
    el.classList.add('op-card-clickable')
    el.addEventListener('click', () => openModal(op.file))
  }

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
        ${op.filed ? '<span style="font-size:11px;color:var(--now)">✓ filed</span>' : '<span style="font-size:11px;color:var(--discard)">✗ not filed</span>'}
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
        <div class="op-file">Is the Java server running on :8080?</div>
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
let recognition = null
let pendingSend = false

function setMicState(state) {
  micState = state
  micBtn.dataset.state = state
  micBtn.disabled = state === 'transcribing'
}

function resizeInput() {
  inputEl.style.height = 'auto'
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px'
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
            resizeInput()
            inputEl.focus()
            pulse()
          }
        } catch (err) {
          appendError('Transcription failed: ' + err.message)
        } finally {
          setMicState('idle')
          if (pendingSend) { pendingSend = false; sendMessage() }
        }
      }
      mediaRecorder.start()

      // Real-time preview via Web Speech API; Whisper corrects on stop
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'es-AR'
        let finalText = ''
        recognition.onresult = e => {
          let interim = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalText += e.results[i][0].transcript
            else interim += e.results[i][0].transcript
          }
          inputEl.value = finalText + interim
          resizeInput()
        }
        recognition.start()
      }

      setMicState('recording')
    } catch {
      appendError('Could not access microphone.')
    }
  } else if (micState === 'recording') {
    if (recognition) { recognition.stop(); recognition = null }
    mediaRecorder.stop()
  }
})

// Focus input on load
inputEl.focus()

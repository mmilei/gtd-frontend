import { fetchItem, replaceBody } from './api.js'

let onSaveCallback = null
let currentFile    = null

export function initModal(onSave) {
  onSaveCallback = onSave

  const overlay = document.createElement('div')
  overlay.id        = 'edit-modal'
  overlay.className = 'modal-overlay hidden'
  overlay.innerHTML = `
    <div class="modal-box">
      <div>
        <div class="modal-label">Editando</div>
        <div class="modal-title" id="modal-item-title"></div>
      </div>
      <textarea id="modal-body" class="modal-textarea" spellcheck="false"></textarea>
      <div class="modal-actions">
        <button id="modal-cancel">Cancelar</button>
        <button id="modal-save">Guardar <kbd>Ctrl+Enter</kbd></button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal()
  })
  document.getElementById('modal-cancel').addEventListener('click', closeModal)
  document.getElementById('modal-save').addEventListener('click', saveModal)

  document.addEventListener('keydown', e => {
    if (!isOpen()) return
    if (e.key === 'Escape') { closeModal(); return }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { saveModal(); return }
  })
}

export function openModal(filename) {
  currentFile = filename
  const titleEl = document.getElementById('modal-item-title')
  const bodyEl  = document.getElementById('modal-body')
  const saveBtn = document.getElementById('modal-save')

  titleEl.textContent = '…'
  bodyEl.value        = ''
  saveBtn.disabled    = true

  document.getElementById('edit-modal').classList.remove('hidden')

  fetchItem(filename)
    .then(item => {
      titleEl.textContent = item.title || item.file || filename
      bodyEl.value        = item.body || ''
      saveBtn.disabled    = false
      bodyEl.focus()
      bodyEl.setSelectionRange(0, 0)
    })
    .catch(() => {
      titleEl.textContent = filename
      saveBtn.disabled    = false
      bodyEl.focus()
    })
}

export function closeModal() {
  document.getElementById('edit-modal').classList.add('hidden')
  currentFile = null
}

export function isOpen() {
  const el = document.getElementById('edit-modal')
  return el && !el.classList.contains('hidden')
}

async function saveModal() {
  if (!currentFile) return
  const saveBtn = document.getElementById('modal-save')
  const body    = document.getElementById('modal-body').value

  saveBtn.disabled     = true
  saveBtn.textContent  = 'Guardando…'

  try {
    await replaceBody(currentFile, body)
    closeModal()
    if (onSaveCallback) await onSaveCallback()
  } catch (err) {
    saveBtn.disabled    = false
    saveBtn.innerHTML   = 'Error — reintentar'
  }
}

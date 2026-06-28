import { fetchItem, replaceBody, patchMeta, markdownifyItem } from './api.js'

const SYSTEM_TAGS = new Set(['gtd', 'action', 'reference', 'project'])

let onSaveCallback = null
let currentFile    = null
let originalItem   = null
let currentTags    = []

export function initModal(onSave) {
  onSaveCallback = onSave

  const overlay = document.createElement('div')
  overlay.id        = 'edit-modal'
  overlay.className = 'modal-overlay hidden'
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-label">Editando</div>
      <input type="text" id="modal-item-title" class="modal-title-input" spellcheck="false">
      <textarea id="modal-body" class="modal-textarea" spellcheck="false"></textarea>
      <div class="modal-meta-section">
        <div class="modal-field">
          <label class="modal-field-label">Tags</label>
          <div class="modal-tags-editor" id="modal-tags-editor"></div>
        </div>
        <div class="modal-dates-row">
          <div class="modal-field">
            <label class="modal-field-label">Fecha límite</label>
            <input type="date" id="modal-due" class="modal-date-input">
          </div>
          <div class="modal-field" id="modal-today-since-field" style="display:none">
            <label class="modal-field-label">En today desde</label>
            <input type="date" id="modal-today-since" class="modal-date-input">
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button id="modal-cancel">Cancelar</button>
        <button id="modal-markdownify" class="modal-markdownify-btn" title="Enriquecer con IA">✨ Mejorar</button>
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
  document.getElementById('modal-markdownify').addEventListener('click', runMarkdownify)

  document.addEventListener('keydown', e => {
    if (!isOpen()) return
    if (e.key === 'Escape') { closeModal(); return }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { saveModal(); return }
  })
}

export function openModal(filename) {
  currentFile  = filename
  originalItem = null
  currentTags  = []

  const titleEl    = document.getElementById('modal-item-title')
  const bodyEl     = document.getElementById('modal-body')
  const saveBtn    = document.getElementById('modal-save')
  const dueEl      = document.getElementById('modal-due')
  const tsField    = document.getElementById('modal-today-since-field')
  const tsEl       = document.getElementById('modal-today-since')

  titleEl.value    = '…'
  bodyEl.value     = ''
  dueEl.value      = ''
  tsEl.value       = ''
  tsField.style.display = 'none'
  saveBtn.innerHTML = 'Guardar <kbd>Ctrl+Enter</kbd>'
  saveBtn.disabled  = true
  renderTagPills()

  document.getElementById('edit-modal').classList.remove('hidden')

  fetchItem(filename)
    .then(item => {
      originalItem = item
      currentTags  = Array.isArray(item.tags) ? [...item.tags] : []

      titleEl.value = item.title || item.file || filename
      bodyEl.value  = item.body || ''
      dueEl.value   = item.due || ''

      if (item.bucket === 'today') {
        tsField.style.display = 'block'
        tsEl.value = item.today_since || ''
      }

      const mdBtn = document.getElementById('modal-markdownify')
      if (item.bucket === 'reference') {
        mdBtn.style.display = 'none'
      } else {
        mdBtn.style.display = ''
        mdBtn.disabled = !!item.markdownified
        mdBtn.title = item.markdownified ? 'Ya fue mejorada con IA' : 'Enriquecer con IA'
      }

      renderTagPills()
      saveBtn.disabled = false
      titleEl.focus()
      titleEl.select()
    })
    .catch(() => {
      titleEl.value    = filename
      saveBtn.disabled = false
      titleEl.focus()
    })
}

export function closeModal() {
  document.getElementById('edit-modal').classList.add('hidden')
  currentFile  = null
  originalItem = null
  currentTags  = []
}

export function isOpen() {
  const el = document.getElementById('edit-modal')
  return el && !el.classList.contains('hidden')
}

function renderTagPills() {
  const container = document.getElementById('modal-tags-editor')
  if (!container) return

  const userTags = currentTags.filter(t => !SYSTEM_TAGS.has(t))

  const pills = userTags.map(t => `
    <span class="modal-tag-pill">
      ${escHtml(t)}
      <button class="tag-remove-btn" data-tag="${escAttr(t)}" title="Quitar tag">×</button>
    </span>
  `).join('')

  container.innerHTML = pills + `
    <input type="text" id="modal-tag-input" class="modal-tag-input" placeholder="+ tag">
  `

  container.querySelectorAll('.tag-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      removeTag(btn.dataset.tag)
    })
  })

  const tagInput = document.getElementById('modal-tag-input')
  tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = tagInput.value.trim().replace(/,/g, '')
      if (val) addTag(val)
    }
    if (e.key === 'Escape') {
      e.stopPropagation()
      tagInput.value = ''
    }
    if (e.key === 'Backspace' && tagInput.value === '' && userTags.length > 0) {
      removeTag(userTags[userTags.length - 1])
    }
  })
  tagInput.addEventListener('blur', () => {
    const val = tagInput.value.trim()
    if (val) addTag(val)
  })
}

function addTag(tag) {
  const clean = tag.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (clean && !currentTags.includes(clean)) {
    currentTags.push(clean)
    renderTagPills()
    document.getElementById('modal-tag-input')?.focus()
  }
}

function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag)
  renderTagPills()
  document.getElementById('modal-tag-input')?.focus()
}

async function runMarkdownify() {
  if (!currentFile) return
  const mdBtn  = document.getElementById('modal-markdownify')
  const bodyEl = document.getElementById('modal-body')

  mdBtn.disabled    = true
  mdBtn.textContent = '✨ Mejorando…'

  try {
    const result = await markdownifyItem(currentFile)
    bodyEl.value = result.body || bodyEl.value
    if (Array.isArray(result.tags)) {
      currentTags = result.tags
      renderTagPills()
    }
    mdBtn.textContent = '✨ Mejorar'
    mdBtn.title = 'Ya fue mejorada con IA'
  } catch {
    mdBtn.disabled    = false
    mdBtn.textContent = '✨ Error — reintentar'
  }
}

async function saveModal() {
  if (!currentFile) return
  const saveBtn = document.getElementById('modal-save')
  const newBody  = document.getElementById('modal-body').value
  const newTitle = document.getElementById('modal-item-title').value.trim()
  const newDue   = document.getElementById('modal-due').value || null
  const newTs    = document.getElementById('modal-today-since').value || null

  saveBtn.disabled    = true
  saveBtn.textContent = 'Guardando…'

  try {
    const orig = originalItem || {}

    const bodyChanged = newBody !== (orig.body || '')
    if (bodyChanged) await replaceBody(currentFile, newBody)

    if (!currentTags.includes('gtd')) currentTags.unshift('gtd')

    const meta = {}
    if (newTitle && newTitle !== (orig.title || '')) meta.title = newTitle
    const sortedCurrent = [...currentTags].sort()
    const sortedOrig = [...(orig.tags || [])].sort()
    if (JSON.stringify(sortedCurrent) !== JSON.stringify(sortedOrig)) meta.tags = currentTags
    if (newDue !== (orig.due || null)) meta.due = newDue
    if (newTs  !== (orig.today_since || null)) meta.today_since = newTs

    if (Object.keys(meta).length > 0) await patchMeta(currentFile, meta)

    closeModal()
    if (onSaveCallback) await onSaveCallback()
  } catch {
    saveBtn.disabled  = false
    saveBtn.innerHTML = 'Error — reintentar'
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function escAttr(s) {
  return String(s).replace(/"/g,'&quot;')
}

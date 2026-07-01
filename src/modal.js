import { fetchItem, replaceBody, patchMeta, markdownifyItem, moveItem, markDone, dismissItem } from './api.js'

const SYSTEM_TAGS = new Set(['gtd', 'action', 'reference', 'project'])

const BUCKET_META = {
  today:     { icon: '⚡', color: 'var(--today)',     label: 'Today' },
  backlog:   { icon: '📋', color: 'var(--backlog)',   label: 'Backlog' },
  waiting:   { icon: '⏳', color: 'var(--waiting)',   label: 'Waiting' },
  someday:   { icon: '🌱', color: 'var(--someday)',   label: 'Someday' },
  reference: { icon: '📚', color: 'var(--reference)', label: 'Ref' },
}

let onSaveCallback = null
let currentFile    = null
let originalItem   = null
let currentTags    = []
let currentPeople  = []
let currentBucket  = null

export function initModal(onSave) {
  onSaveCallback = onSave

  const overlay = document.createElement('div')
  overlay.id        = 'edit-modal'
  overlay.className = 'modal-overlay hidden'
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-bucket-selector" id="modal-bucket-selector"></div>
      <input type="text" id="modal-item-title" class="modal-title-input" spellcheck="false">
      <textarea id="modal-body" class="modal-textarea" spellcheck="false"></textarea>
      <div class="modal-meta-section">
        <div class="modal-field">
          <label class="modal-field-label">Tags</label>
          <div class="modal-tags-editor" id="modal-tags-editor"></div>
        </div>
        <div class="modal-dates-row">
          <div class="modal-field">
            <label class="modal-field-label">Due date</label>
            <input type="date" id="modal-due" class="modal-date-input">
          </div>
          <div class="modal-field" id="modal-today-since-field" style="display:none">
            <label class="modal-field-label">In today since</label>
            <input type="date" id="modal-today-since" class="modal-date-input">
          </div>
        </div>
        <div class="modal-field">
          <label class="modal-field-label">Related people</label>
          <div class="modal-tags-editor" id="modal-people-editor"></div>
        </div>
        <div class="modal-field modal-field-conditional" id="modal-area-field">
          <label class="modal-field-label">Area</label>
          <input type="text" id="modal-area" class="modal-date-input" placeholder="e.g. work, health, finance">
        </div>
      </div>
      <datalist id="modal-tag-suggestions"></datalist>
      <div class="modal-discard-confirm hidden" id="modal-discard-confirm">
        <span class="discard-msg">Discard unsaved changes?</span>
        <button id="modal-discard-yes">Discard</button>
        <button id="modal-discard-no">Keep editing</button>
      </div>
      <div class="modal-actions">
        <button id="modal-done" class="modal-done-btn">✓ Done</button>
        <button id="modal-dismiss" class="modal-dismiss-btn">🗑 Discard</button>
        <button id="modal-cancel">Cancel</button>
        <button id="modal-markdownify" class="modal-markdownify-btn" title="Enrich with AI">✨ Improve</button>
        <button id="modal-save">Save <kbd>Ctrl+Enter</kbd></button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  overlay.addEventListener('click', e => {
    if (e.target === overlay) tryClose()
  })
  document.getElementById('modal-cancel').addEventListener('click', tryClose)
  document.getElementById('modal-discard-yes').addEventListener('click', () => {
    if (originalItem) {
      populateFields(originalItem, currentFile)
      hideDiscardConfirm()
    } else {
      closeModal()
    }
  })
  document.getElementById('modal-discard-no').addEventListener('click', hideDiscardConfirm)

  document.querySelector('.modal-box').addEventListener('input', updateCancelBtn)
  document.querySelector('.modal-box').addEventListener('change', updateCancelBtn)
  document.getElementById('modal-save').addEventListener('click', saveModal)
  document.getElementById('modal-markdownify').addEventListener('click', runMarkdownify)
  document.getElementById('modal-done').addEventListener('click', async () => {
    if (!currentFile) return
    const btn = document.getElementById('modal-done')
    btn.disabled = true
    btn.textContent = '✓ Marking…'
    try {
      await markDone(currentFile)
      closeModal()
      if (onSaveCallback) await onSaveCallback()
    } catch {
      btn.disabled = false
      btn.textContent = '✓ Done'
    }
  })

  document.getElementById('modal-dismiss').addEventListener('click', async () => {
    if (!currentFile) return
    const btn = document.getElementById('modal-dismiss')
    btn.disabled = true
    btn.textContent = '🗑 Discarding…'
    try {
      await dismissItem(currentFile)
      closeModal()
      if (onSaveCallback) await onSaveCallback()
    } catch {
      btn.disabled = false
      btn.textContent = '🗑 Discard'
    }
  })

  document.addEventListener('keydown', e => {
    if (!isOpen()) return
    if (e.key === 'Escape') { tryClose(); return }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { saveModal(); return }
  })
}

export function openModal(filename) {
  currentFile   = filename
  originalItem  = null
  currentTags   = []
  currentPeople = []
  currentBucket = null

  const titleEl = document.getElementById('modal-item-title')
  const bodyEl  = document.getElementById('modal-body')
  const saveBtn = document.getElementById('modal-save')
  const dueEl   = document.getElementById('modal-due')
  const tsEl    = document.getElementById('modal-today-since')
  const areaEl  = document.getElementById('modal-area')

  titleEl.value = '…'
  bodyEl.value  = ''
  dueEl.value   = ''
  tsEl.value    = ''
  if (areaEl) areaEl.value = ''
  saveBtn.innerHTML = 'Save <kbd>Ctrl+Enter</kbd>'
  saveBtn.disabled  = true
  renderBucketSelector()
  renderTagPills()
  renderPeoplePills()
  updateConditionalFields(null)

  document.getElementById('edit-modal').classList.remove('hidden')

  fetchItem(filename)
    .then(item => {
      originalItem = item
      populateFields(item, filename)
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

function populateFields(item, filename) {
  const titleEl = document.getElementById('modal-item-title')
  const bodyEl  = document.getElementById('modal-body')
  const dueEl   = document.getElementById('modal-due')
  const tsEl    = document.getElementById('modal-today-since')
  const areaEl  = document.getElementById('modal-area')

  currentTags   = Array.isArray(item.tags) ? [...item.tags] : []
  currentPeople = Array.isArray(item.delegado_a) ? [...item.delegado_a] : []
  currentBucket = item.bucket || null

  titleEl.value = item.title || item.file || filename
  bodyEl.value  = item.body  || ''
  dueEl.value   = item.due   || ''
  tsEl.value    = item.today_since || ''
  if (areaEl) areaEl.value = item.area || ''

  renderBucketSelector()
  renderTagPills()
  renderPeoplePills()
  updateConditionalFields(currentBucket)
  updateCancelBtn()

  const mdBtn = document.getElementById('modal-markdownify')
  mdBtn.disabled = !!item.markdownified
  mdBtn.title    = item.markdownified ? 'Already improved with AI' : 'Enrich with AI'
}

export function closeModal() {
  document.getElementById('edit-modal').classList.add('hidden')
  hideDiscardConfirm()
  currentFile   = null
  originalItem  = null
  currentTags   = []
  currentPeople = []
  currentBucket = null
}

export function isOpen() {
  const el = document.getElementById('edit-modal')
  return el && !el.classList.contains('hidden')
}

function renderBucketSelector() {
  const container = document.getElementById('modal-bucket-selector')
  if (!container) return

  container.innerHTML = Object.entries(BUCKET_META).map(([key, meta]) => {
    const isActive = key === currentBucket
    return `<button
      class="modal-bucket-chip${isActive ? ' active' : ''}"
      data-bucket="${key}"
    >${meta.icon} ${meta.label}</button>`
  }).join('')

  container.querySelectorAll('.modal-bucket-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      currentBucket = btn.dataset.bucket
      renderBucketSelector()
      updateConditionalFields(currentBucket)
      updateCancelBtn()
    })
  })
}

function updateConditionalFields(bucket) {
  const tsField  = document.getElementById('modal-today-since-field')
  const mdBtn    = document.getElementById('modal-markdownify')
  const box      = document.querySelector('.modal-box')

  if (box) box.dataset.bucket = bucket || ''

  if (tsField) {
    tsField.classList.toggle('modal-field-conditional', true)
    tsField.classList.toggle('visible', bucket === 'today')
  }
  const areaField = document.getElementById('modal-area-field')
  if (areaField) areaField.classList.toggle('visible', bucket === 'reference')
  if (mdBtn) mdBtn.style.display = bucket === 'reference' ? 'none' : ''
}

function renderTagPills() {
  const container = document.getElementById('modal-tags-editor')
  if (!container) return

  const userTags = currentTags.filter(t => !SYSTEM_TAGS.has(t))

  const pills = userTags.map(t => `
    <span class="modal-tag-pill">
      ${escHtml(t)}
      <button class="tag-remove-btn" data-tag="${escAttr(t)}" title="Remove tag">×</button>
    </span>
  `).join('')

  container.innerHTML = pills + `
    <input type="text" id="modal-tag-input" class="modal-tag-input" placeholder="+ tag" list="modal-tag-suggestions">
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
    updateCancelBtn()
    document.getElementById('modal-tag-input')?.focus()
  }
}

function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag)
  renderTagPills()
  updateCancelBtn()
  document.getElementById('modal-tag-input')?.focus()
}

function renderPeoplePills() {
  const container = document.getElementById('modal-people-editor')
  if (!container) return

  const pills = currentPeople.map(p => `
    <span class="modal-tag-pill">
      ${escHtml(p)}
      <button class="tag-remove-btn" data-person="${escAttr(p)}" title="Remove person">×</button>
    </span>
  `).join('')

  container.innerHTML = pills + `
    <input type="text" id="modal-people-input" class="modal-tag-input" placeholder="+ person">
  `

  container.querySelectorAll('.tag-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      removePerson(btn.dataset.person)
    })
  })

  const peopleInput = document.getElementById('modal-people-input')
  peopleInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = peopleInput.value.trim().replace(/,/g, '')
      if (val) addPerson(val)
    }
    if (e.key === 'Escape') {
      e.stopPropagation()
      peopleInput.value = ''
    }
    if (e.key === 'Backspace' && peopleInput.value === '' && currentPeople.length > 0) {
      removePerson(currentPeople[currentPeople.length - 1])
    }
  })
  peopleInput.addEventListener('blur', () => {
    const val = peopleInput.value.trim()
    if (val) addPerson(val)
  })
}

function addPerson(name) {
  const clean = name.trim()
  if (clean && !currentPeople.includes(clean)) {
    currentPeople.push(clean)
    renderPeoplePills()
    updateCancelBtn()
    document.getElementById('modal-people-input')?.focus()
  }
}

function removePerson(name) {
  currentPeople = currentPeople.filter(p => p !== name)
  renderPeoplePills()
  updateCancelBtn()
  document.getElementById('modal-people-input')?.focus()
}

async function runMarkdownify() {
  if (!currentFile) return
  const mdBtn  = document.getElementById('modal-markdownify')
  const bodyEl = document.getElementById('modal-body')

  mdBtn.disabled    = true
  mdBtn.textContent = '✨ Improving…'

  try {
    const result = await markdownifyItem(currentFile)
    bodyEl.value = result.body || bodyEl.value
    if (Array.isArray(result.tags)) {
      currentTags = result.tags
      renderTagPills()
    }
    mdBtn.textContent = '✨ Improve'
    mdBtn.title = 'Already improved with AI'
  } catch {
    mdBtn.disabled    = false
    mdBtn.textContent = '✨ Error — retry'
  }
}

function isDirty() {
  if (!originalItem) return false
  const title = document.getElementById('modal-item-title').value.trim()
  const body  = document.getElementById('modal-body').value
  const due   = document.getElementById('modal-due').value || null
  return title !== (originalItem.title || '') ||
    body !== (originalItem.body || '') ||
    currentBucket !== (originalItem.bucket || null) ||
    JSON.stringify([...currentTags].sort()) !== JSON.stringify([...(originalItem.tags || [])].sort()) ||
    JSON.stringify([...currentPeople].sort()) !== JSON.stringify([...(originalItem.delegado_a || [])].sort()) ||
    due !== (originalItem.due || null)
}

function updateCancelBtn() {
  const btn = document.getElementById('modal-cancel')
  if (btn) btn.textContent = isDirty() ? 'Discard changes' : 'Cancel'
}

function tryClose() {
  if (isDirty()) { showDiscardConfirm() } else { closeModal() }
}

function showDiscardConfirm() {
  document.getElementById('modal-discard-confirm').classList.remove('hidden')
  document.querySelector('.modal-actions').classList.add('hidden')
}

function hideDiscardConfirm() {
  const el = document.getElementById('modal-discard-confirm')
  if (el) el.classList.add('hidden')
  const actions = document.querySelector('.modal-actions')
  if (actions) actions.classList.remove('hidden')
}

async function saveModal() {
  if (!currentFile) return
  hideDiscardConfirm()
  const saveBtn  = document.getElementById('modal-save')
  const newBody  = document.getElementById('modal-body').value
  const newTitle = document.getElementById('modal-item-title').value.trim()
  const newDue   = document.getElementById('modal-due').value || null
  const newTs    = document.getElementById('modal-today-since').value || null

  saveBtn.disabled    = true
  saveBtn.textContent = 'Saving…'

  try {
    const orig = originalItem || {}
    const today = new Date().toISOString().slice(0, 10)

    // 1. Bucket change
    if (currentBucket && currentBucket !== orig.bucket) {
      await moveItem(currentFile, currentBucket,
        currentBucket === 'today' ? (newDue || null) : null
      )
    }

    // 2. Body
    if (newBody !== (orig.body || '')) await replaceBody(currentFile, newBody)

    // 3. Meta patch
    if (!currentTags.includes('gtd')) currentTags.unshift('gtd')

    const meta = {}
    if (newTitle && newTitle !== (orig.title || '')) meta.title = newTitle

    const sortedCurrent = [...currentTags].sort()
    const sortedOrig    = [...(orig.tags || [])].sort()
    if (JSON.stringify(sortedCurrent) !== JSON.stringify(sortedOrig)) meta.tags = currentTags

    if (newDue !== (orig.due || null)) meta.due = newDue

    // Auto-set today_since when moving to today
    if (currentBucket === 'today' && !orig.today_since && !newTs) {
      meta.today_since = today
    } else if (newTs !== (orig.today_since || null)) {
      meta.today_since = newTs
    }

    const sortedPeople     = [...currentPeople].sort()
    const sortedOrigPeople = [...(orig.delegado_a || [])].sort()
    if (JSON.stringify(sortedPeople) !== JSON.stringify(sortedOrigPeople)) meta.delegado_a = currentPeople

    const areaVal = document.getElementById('modal-area')?.value.trim() || null
    if (areaVal !== (orig.area || null)) meta.area = areaVal

    if (Object.keys(meta).length > 0) await patchMeta(currentFile, meta)

    // Sync snapshot so isDirty() returns false after save
    originalItem = { ...originalItem, title: newTitle, body: newBody, bucket: currentBucket, tags: [...currentTags], due: newDue, today_since: newTs, delegado_a: [...currentPeople] }

    saveBtn.disabled = false
    saveBtn.innerHTML = 'Saved ✓'
    setTimeout(() => { saveBtn.innerHTML = 'Save <kbd>Ctrl+Enter</kbd>'; updateCancelBtn() }, 1000)
    updateCancelBtn()
    if (onSaveCallback) await onSaveCallback()
  } catch {
    saveBtn.disabled  = false
    saveBtn.innerHTML = 'Error — retry'
  }
}

export function updateTagSuggestions(items) {
  const dl = document.getElementById('modal-tag-suggestions')
  if (!dl) return
  const tags = new Set()
  items.forEach(item => (item.tags || []).forEach(t => tags.add(t)))
  dl.innerHTML = [...tags].map(t => `<option value="${escAttr(t)}">`).join('')
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function escAttr(s) {
  return String(s).replace(/"/g,'&quot;')
}

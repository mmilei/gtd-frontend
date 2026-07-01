import { getProviders, selectProvider } from './api.js'

let menuOpen = false

export function initProviderMenu() {
  const trigger = document.getElementById('header-status')
  const menu = document.getElementById('provider-menu')

  trigger.addEventListener('click', e => {
    e.stopPropagation()
    menuOpen ? closeMenu() : openMenu()
  })

  trigger.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      menuOpen ? closeMenu() : openMenu()
    }
  })

  document.addEventListener('click', e => {
    if (menuOpen && !menu.contains(e.target)) closeMenu()
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menuOpen) closeMenu()
  })
}

async function openMenu() {
  const menu = document.getElementById('provider-menu')
  menuOpen = true
  menu.classList.add('open')
  menu.innerHTML = '<div class="provider-row disabled">Loading…</div>'

  try {
    const { active, providers } = await getProviders()
    renderRows(active, providers)
  } catch {
    menu.innerHTML = '<div class="provider-row disabled">Could not load providers.</div>'
  }
}

function closeMenu() {
  menuOpen = false
  document.getElementById('provider-menu').classList.remove('open')
}

function renderRows(active, providers) {
  const menu = document.getElementById('provider-menu')
  menu.innerHTML = ''

  for (const p of providers) {
    const row = document.createElement('div')
    const isActive = p.id === active
    const isUp = p.status === 'UP'
    row.className = `provider-row${isActive ? ' active' : ''}${isUp ? '' : ' disabled'}`
    row.innerHTML = `
      <span class="status-dot ${isUp ? 'online' : 'offline'}"></span>
      <span class="provider-label">${p.label}</span>
      ${isActive ? '<span class="provider-active-tag">active</span>' : ''}
    `
    if (isUp && !isActive) {
      row.addEventListener('click', e => {
        e.stopPropagation()
        handleSelect(p.id, p.label, active, providers)
      })
    }
    menu.appendChild(row)
  }
}

async function handleSelect(id, label, prevActive, providers) {
  try {
    await selectProvider(id)
    document.getElementById('api-label').textContent = `API online — ${label}`
    closeMenu()
  } catch {
    // keep the menu open and show the failure inline instead of closing silently —
    // the user needs to know the switch didn't take effect
    renderRows(prevActive, providers)
    const errorRow = document.createElement('div')
    errorRow.className = 'provider-row disabled provider-error'
    errorRow.textContent = `Could not switch to ${label}.`
    document.getElementById('provider-menu').appendChild(errorRow)
  }
}

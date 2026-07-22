import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../lib/types'
import { EditModal } from './EditModal'

vi.mock('../lib/api', () => ({
  fetchItem: vi.fn(),
  patchMeta: vi.fn(),
  moveItem: vi.fn(),
  replaceBody: vi.fn(),
  markDone: vi.fn(),
  dismissItem: vi.fn(),
  markdownifyItem: vi.fn(),
}))

import { fetchItem, patchMeta } from '../lib/api'

const AREAS = ['personal', 'friends', 'exercise', 'work', 'health', 'finance', 'home', 'learning']

function renderModal(item: Item, areaOptions: string[] = AREAS) {
  vi.mocked(fetchItem).mockResolvedValue(item)
  vi.mocked(patchMeta).mockImplementation(async (_file, meta) => ({ ...item, ...meta }))
  return render(
    <EditModal
      file={item.file}
      tagSuggestions={[]}
      projectSuggestions={[]}
      locationSuggestions={[]}
      areaOptions={areaOptions}
      onClose={() => {}}
      onSaved={() => {}}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('estimate saving (regression: modal stayed dirty after save)', () => {
  it('persists the new estimate and leaves the modal clean after saving', async () => {
    const user = userEvent.setup()
    renderModal({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [], estimate_minutes: null })

    const estimate = await screen.findByPlaceholderText('e.g. 30')
    await user.type(estimate, '30')
    // dirty state shows "Discard changes" in place of "Cancel"
    expect(screen.getByText('Discard changes')).toBeInTheDocument()

    await user.click(screen.getByText('Save'))
    await screen.findByText('Saved ✓')

    expect(patchMeta).toHaveBeenCalledWith('t.md', expect.objectContaining({ estimate_minutes: 30 }))
    // the fix under test: original.estimate_minutes is refreshed on save, so the modal is clean again
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.queryByText('Discard changes')).not.toBeInTheDocument()
  })
})

describe('today_since', () => {
  it('is displayed read-only for today items, with no editable control', async () => {
    renderModal({ file: 't.md', title: 'Task', bucket: 'today', tags: [], today_since: '2026-07-01' })

    const value = await screen.findByText('2026-07-01')
    expect(value.tagName).toBe('SPAN')
  })

  it('is never sent on save unless the item first enters today without one', async () => {
    const user = userEvent.setup()
    renderModal({ file: 't.md', title: 'Task', bucket: 'today', tags: [], today_since: '2026-07-01' })

    const title = await screen.findByPlaceholderText('Title')
    await user.type(title, ' edited')
    await user.click(screen.getByText('Save'))

    await waitFor(() => expect(patchMeta).toHaveBeenCalled())
    expect(vi.mocked(patchMeta).mock.calls[0][1]).not.toHaveProperty('today_since')
  })
})

describe('priority segmented control', () => {
  it('offers Low/Medium/High and persists the choice', async () => {
    const user = userEvent.setup()
    renderModal({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [] })

    await screen.findByPlaceholderText('Title')
    const group = screen.getByRole('group', { name: 'Priority' })
    await user.click(within(group).getByRole('button', { name: 'High' }))
    expect(screen.getByText('Discard changes')).toBeInTheDocument()

    await user.click(screen.getByText('Save'))
    await screen.findByText('Saved ✓')
    expect(patchMeta).toHaveBeenCalledWith('t.md', expect.objectContaining({ priority: 'high' }))
  })

  it('defaults to unset (—) for an item with no priority', async () => {
    renderModal({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [] })

    await screen.findByPlaceholderText('Title')
    const group = screen.getByRole('group', { name: 'Priority' })
    expect(within(group).getByRole('button', { name: '—' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('area select', () => {
  it('offers the configured vocabulary', async () => {
    renderModal({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [] })

    await screen.findByPlaceholderText('Title')
    for (const a of AREAS) {
      expect(screen.getByRole('option', { name: a })).toBeInTheDocument()
    }
  })

  it('keeps an out-of-vocabulary value visible as a legacy option instead of rendering empty', async () => {
    renderModal({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [], area: 'trabajo' })

    await screen.findByPlaceholderText('Title')
    // the project/location inputs carry a datalist (combobox role too) — target the Area select by its label
    const select = screen.getByLabelText('Area') as HTMLSelectElement
    expect(select.value).toBe('trabajo')
    expect(screen.getByRole('option', { name: 'trabajo (legacy)' })).toBeInTheDocument()
  })
})

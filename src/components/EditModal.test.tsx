import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item, VaultPage } from '../lib/types'
import { EditModal } from './EditModal'
import type { EditProps } from './EditModal'

vi.mock('../lib/api', () => ({
  fetchItem: vi.fn(),
  patchMeta: vi.fn(),
  moveItem: vi.fn(),
  replaceBody: vi.fn(),
  markDone: vi.fn(),
  dismissItem: vi.fn(),
  markdownifyItem: vi.fn(),
  createItem: vi.fn(),
  // MarkdownEditor loads the autocomplete sources when it mounts inside the modal.
  getPeople: vi.fn(async () => []),
  getPages: vi.fn(async () => []),
}))

import { createItem, fetchItem, moveItem, patchMeta, replaceBody } from '../lib/api'

const AREAS = ['personal', 'friends', 'exercise', 'work', 'health', 'finance', 'home', 'learning']

function renderModal(item: Item, areaOptions: string[] = AREAS, onNavigate?: EditProps['onNavigate']) {
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
      onNavigate={onNavigate}
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

describe('tag editing on an existing task (G8)', () => {
  it('adds a new tag and removes an existing one, persisting the full set via patchMeta', async () => {
    const user = userEvent.setup()
    renderModal({ file: 't.md', title: 'Task', bucket: 'backlog', tags: ['errands', 'home'] })

    await screen.findByPlaceholderText('Title')
    // remove the "errands" pill
    await user.click(screen.getByRole('button', { name: 'Remove errands' }))
    // add a new "urgent" pill
    await user.type(screen.getByPlaceholderText('+ tag'), 'urgent{enter}')
    expect(screen.getByText('Discard changes')).toBeInTheDocument()

    await user.click(screen.getByText('Save'))
    await screen.findByText('Saved ✓')

    expect(patchMeta).toHaveBeenCalledWith('t.md', expect.objectContaining({ tags: ['home', 'urgent'] }))
  })
})

describe('body editor (CodeMirror)', () => {
  // CodeMirror's editable surface is a contenteditable exposing role="textbox"; the aria-label
  // MarkdownEditor derives from the placeholder is what separates it from the plain <input>
  // textboxes on the same form. jsdom reports no layout, so a click leaves the cursor at offset 0
  // and a typed character lands at the front of the document.
  const editor = () => screen.getByRole('textbox', { name: 'Notes (markdown)' })

  // One character at a time on purpose: CodeMirror reads typing back out of the DOM through a
  // MutationObserver, and under jsdom a burst of synthetic keystrokes outruns that flush and
  // arrives scrambled. A single keypress per assertion is deterministic and proves the same path.
  async function typeOne(user: ReturnType<typeof userEvent.setup>, char: string) {
    await user.click(editor())
    await user.keyboard(char)
  }

  it('shows the fetched body and persists a typed edit through replaceBody', async () => {
    const user = userEvent.setup()
    renderModal({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [], body: 'first line' })

    // the body arrives from the fetch after mount, so this also covers the outside-in value sync
    await waitFor(() => expect(editor()).toHaveTextContent('first line'))
    await typeOne(user, 'X')
    expect(screen.getByText('Discard changes')).toBeInTheDocument()

    await user.click(screen.getByText('Save'))
    await screen.findByText('Saved ✓')
    expect(replaceBody).toHaveBeenCalledWith('t.md', 'Xfirst line')
  })

  it('still saves on Ctrl+Enter from inside the editor', async () => {
    const user = userEvent.setup()
    renderModal({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [], body: 'first line' })

    await waitFor(() => expect(editor()).toHaveTextContent('first line'))
    await typeOne(user, 'X')
    await user.keyboard('{Control>}{Enter}{/Control}')

    await screen.findByText('Saved ✓')
    // The default keymap binds Mod-Enter to insertBlankLine, so the save binding has to outrank it:
    // an unchanged body here is what proves no blank line was inserted first.
    expect(replaceBody).toHaveBeenCalledWith('t.md', 'Xfirst line')
  })
})

describe('vault link chips', () => {
  const TASK_PATH = 'brain/backlog/20260627-150000-write-project-readme.md'
  const LINKS: VaultPage[] = [
    { name: 'Write project README', kind: 'TASK', path: TASK_PATH, obsidianUri: 'obsidian://open?file=readme' },
    { name: 'Augusto', kind: 'PERSON', path: 'brain/entities/augusto.md', obsidianUri: 'obsidian://open?file=augusto' },
    { name: 'GTD', kind: 'NOTE', path: 'brain/reference/gtd.md', obsidianUri: 'obsidian://open?file=gtd' },
  ]

  const linked = (onNavigate?: EditProps['onNavigate']) =>
    renderModal({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [], links: LINKS }, AREAS, onNavigate)

  /** Dispatched by hand rather than through userEvent so the event object is available to inspect. */
  function plainClick(el: Element) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    fireEvent(el, event)
    return event
  }

  it('points a TASK at its card route, keeping the vault bucket as the path segment', async () => {
    linked()
    expect(await screen.findByRole('link', { name: 'Write project README' })).toHaveAttribute(
      'href',
      '/backlog/20260627-150000-write-project-readme.md',
    )
  })

  it('points a PERSON at the person facet', async () => {
    linked()
    expect(await screen.findByRole('link', { name: 'Augusto' })).toHaveAttribute('href', '/persona/Augusto')
  })

  it('points a NOTE straight at Obsidian — it has no route in this app', async () => {
    linked()
    expect(await screen.findByRole('link', { name: 'GTD' })).toHaveAttribute('href', 'obsidian://open?file=gtd')
  })

  it('intercepts a plain click on a TASK chip instead of letting the browser reload the page', async () => {
    const onNavigate = vi.fn()
    linked(onNavigate)

    const event = plainClick(await screen.findByRole('link', { name: 'Write project README' }))

    expect(event.defaultPrevented).toBe(true)
    expect(onNavigate).toHaveBeenCalledWith('/backlog/20260627-150000-write-project-readme.md', { modal: true })
  })

  it('leaves a NOTE chip alone so the native obsidian:// link opens', async () => {
    const onNavigate = vi.fn()
    linked(onNavigate)

    const event = plainClick(await screen.findByRole('link', { name: 'GTD' }))

    expect(event.defaultPrevented).toBe(false)
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('leaves a ctrl+click alone so "open in new tab" still works', async () => {
    const onNavigate = vi.fn()
    linked(onNavigate)

    const link = await screen.findByRole('link', { name: 'Write project README' })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })
    fireEvent(link, event)

    expect(event.defaultPrevented).toBe(false)
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('renders nothing when the item has no links', async () => {
    renderModal({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [] })
    await screen.findByPlaceholderText('Title')
    expect(screen.queryByText('Links')).not.toBeInTheDocument()
  })
})

describe('creating a new task (file=null)', () => {
  function renderNewModal() {
    return render(
      <EditModal
        file={null}
        tagSuggestions={[]}
        projectSuggestions={[]}
        locationSuggestions={[]}
        areaOptions={AREAS}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    )
  }

  it('opens blank, with no fetch, and "Save as new" instead of "Save"', () => {
    renderNewModal()
    expect(fetchItem).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('Title')).toHaveValue('')
    expect(screen.getByText('Save as new')).toBeInTheDocument()
    // Done/Discard/Improve act on a persisted file — hidden until one exists
    expect(screen.queryByText('Done')).not.toBeInTheDocument()
  })

  it('files the task in one direct call, no classifier involved', async () => {
    const user = userEvent.setup()
    vi.mocked(createItem).mockResolvedValue({ filed: true, file: 'new-task.md', bucket: 'today', title: 'Water the plants' })

    renderNewModal()
    await user.type(screen.getByPlaceholderText('Title'), 'Water the plants')
    // modal defaults to backlog; move it to today by hand
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await user.click(screen.getByText('Save as new'))

    await waitFor(() => expect(createItem).toHaveBeenCalled())
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'today', title: 'Water the plants' }),
    )
    expect(moveItem).not.toHaveBeenCalled()
    expect(patchMeta).not.toHaveBeenCalled()
  })

  it('surfaces an error and stays open if the server rejects the create', async () => {
    const user = userEvent.setup()
    vi.mocked(createItem).mockRejectedValue(new Error('bucket must be one of ...'))

    renderNewModal()
    await user.type(screen.getByPlaceholderText('Title'), 'do it now')
    await user.click(screen.getByText('Save as new'))

    await screen.findByText('Error — retry')
  })
})

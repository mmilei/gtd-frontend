import { EditorView } from '@codemirror/view'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultPage } from '../lib/types'
import { MarkdownEditor } from './MarkdownEditor'

vi.mock('../lib/api', () => ({
  getPeople: vi.fn(),
  getPages: vi.fn(),
  createPerson: vi.fn(),
}))

import { createPerson, getPages, getPeople } from '../lib/api'

const page = (name: string, kind: VaultPage['kind']): VaultPage => ({
  name,
  kind,
  path: `brain/${name}.md`,
  obsidianUri: `obsidian://open?file=${name}`,
})

const PEOPLE = [page('Augusto', 'PERSON'), page('Bruno', 'PERSON')]
const PAGES = [...PEOPLE, page('Write project README', 'TASK')]

beforeEach(() => {
  vi.mocked(getPeople).mockReset().mockResolvedValue(PEOPLE)
  vi.mocked(getPages).mockReset().mockResolvedValue(PAGES)
  vi.mocked(createPerson).mockReset().mockImplementation(name => Promise.resolve({ created: true, name }))
})

/**
 * Mirrors how EditModal drives the editor: the value it hands back through `onChange` is exactly
 * what would reach `setBody`/`replaceBody`, so asserting on `data-testid="outward"` asserts on the
 * text that would be saved to the vault.
 */
function Harness({ initial, tags = [] }: { initial: string; tags?: string[] }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <MarkdownEditor
        value={value}
        onChange={setValue}
        onSave={() => {}}
        tagSuggestions={tags}
        placeholder="Notes (markdown)"
      />
      <output data-testid="outward">{value}</output>
    </>
  )
}

const editor = () => screen.getByRole('textbox', { name: 'Notes (markdown)' })
const outward = () => screen.getByTestId('outward').textContent

/** The editor's own document, i.e. the buffer the decorations must never mutate. */
const doc = () => EditorView.findFromDOM(editor() as HTMLElement)?.state.doc.toString()

// One key per await, as in EditModal.test.tsx: CodeMirror picks synthetic typing up through a
// MutationObserver, and a burst outruns that flush under jsdom.
async function keys(user: ReturnType<typeof userEvent.setup>, text: string) {
  for (const char of text) {
    await user.keyboard(char.replace(/[{[]/g, '$&$&'))
  }
}

async function type(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(editor())
  await keys(user, text)
}

describe('wikilink decorations', () => {
  it('leaves the typed [[Target]] intact in the document even once the brackets are hidden', async () => {
    const user = userEvent.setup()
    // second line only so the cursor has somewhere else to go — the brackets stay visible while the
    // cursor sits on the wikilink's own line
    render(<Harness initial={'\nsecond line'} />)

    await type(user, '[[Target]]')
    const view = EditorView.findFromDOM(editor() as HTMLElement)!
    act(() => view.dispatch({ selection: { anchor: view.state.doc.line(2).from } }))

    expect(editor().textContent).not.toContain('[[')

    // The load-bearing assertion of this feature: whatever the decorations hide on screen, the
    // buffer and the outward value still carry the full source — a wikilink that lost its brackets
    // on save would be a dead link in the vault.
    expect(doc()).toBe('[[Target]]\nsecond line')
    expect(outward()).toBe('[[Target]]\nsecond line')
  })

  it('hides the brackets on lines without the cursor and restores them when the cursor lands there', async () => {
    render(<Harness initial={'first line\n[[Target]]'} />)

    // the cursor starts at offset 0, so line 2 renders decorated
    expect(editor()).toHaveTextContent('Target')
    expect(editor().textContent).not.toContain('[[')
    expect(doc()).toBe('first line\n[[Target]]')

    const view = EditorView.findFromDOM(editor() as HTMLElement)!
    act(() => view.dispatch({ selection: { anchor: view.state.doc.line(2).from } }))

    // cursor on the wikilink's line: raw source again, so it can be edited
    expect(editor().textContent).toContain('[[Target]]')
    expect(doc()).toBe('first line\n[[Target]]')
    expect(outward()).toBe('first line\n[[Target]]')
  })
})

describe('task checkboxes', () => {
  it('rewrites the marker in the document when the rendered checkbox is clicked', async () => {
    const user = userEvent.setup()
    render(<Harness initial="- [ ] buy milk" />)

    const box = screen.getByRole('checkbox')
    expect(box).not.toBeChecked()
    // the literal marker is gone from the rendered text — the widget stands in for it
    expect(editor().textContent).not.toContain('[ ]')

    await user.click(box)

    // Unlike the wikilink decorations, this one writes: the toggle has to reach the saved body.
    expect(doc()).toBe('- [x] buy milk')
    expect(outward()).toBe('- [x] buy milk')
    expect(screen.getByRole('checkbox')).toBeChecked()

    await user.click(screen.getByRole('checkbox'))

    expect(doc()).toBe('- [ ] buy milk')
    expect(outward()).toBe('- [ ] buy milk')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('keeps indentation and toggles the clicked line only', async () => {
    const user = userEvent.setup()
    render(<Harness initial={'- [ ] first\n  - [x] second\nnot a task'} />)

    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)

    await user.click(boxes[1])

    expect(doc()).toBe('- [ ] first\n  - [ ] second\nnot a task')
  })
})

/** The suggestion list CodeMirror renders — `li[role=option]` inside the autocomplete tooltip. */
const optionNamed = (name: string | RegExp) => screen.findByRole('option', { name })

/**
 * @codemirror/autocomplete drops Enter for the first `interactionDelay` (75ms) after the dropdown
 * opens — its guard against accepting a suggestion the user never saw.
 */
async function accept(user: ReturnType<typeof userEvent.setup>) {
  await new Promise(resolve => setTimeout(resolve, 100))
  await user.keyboard('{Enter}')
}

describe('autocomplete', () => {
  it('inserts [[Name]] when a person is picked from the @ suggestions', async () => {
    const user = userEvent.setup()
    render(<Harness initial="" />)

    await type(user, '@Aug')
    await optionNamed(/Augusto/)
    await accept(user)

    // The `@` and everything typed after it are replaced by the wikilink the vault understands.
    expect(doc()).toBe('[[Augusto]]')
    expect(outward()).toBe('[[Augusto]]')
  })

  it('offers pages after [[ and tags after #', async () => {
    const user = userEvent.setup()
    render(<Harness initial="" tags={['home', 'hardware']} />)

    await type(user, '[[Write')
    await optionNamed(/Write project README/)
    await accept(user)
    expect(doc()).toBe('[[Write project README]]')

    await user.keyboard('{Enter}')
    await keys(user, '#hard')
    await optionNamed('hardware')
    await accept(user)
    expect(doc()).toBe('[[Write project README]]\n#hardware')
  })

  it('offers to create a person only when the typed name matches nobody', async () => {
    const user = userEvent.setup()
    render(<Harness initial="" />)

    // A name the vault knows: the person is offered, creating one is not.
    await type(user, '@Aug')
    await optionNamed(/Augusto/)
    expect(screen.queryByRole('option', { name: /create person/ })).toBeNull()

    await user.keyboard('{Escape}')
    await keys(user, ' @Zeb')

    // Nobody matches, so the create option is the way out of the dead end.
    await optionNamed(/create person "Zeb"/)
    expect(screen.queryByRole('option', { name: /Augusto/ })).toBeNull()
  })

  it('creates the person and inserts the wikilink when the create option is picked', async () => {
    const user = userEvent.setup()
    render(<Harness initial="" />)

    await type(user, '@Zeb')
    await optionNamed(/create person "Zeb"/)
    await accept(user)

    await waitFor(() => expect(doc()).toBe('[[Zeb]]'))
    expect(createPerson).toHaveBeenCalledExactlyOnceWith('Zeb')
    expect(outward()).toBe('[[Zeb]]')

    // The list fetched on mount now knows them, so the same name stops offering to create it.
    await keys(user, ' @Zeb')
    await optionNamed(/^Zeb/)
    expect(screen.queryByRole('option', { name: /create person/ })).toBeNull()
  })

  it('makes the created person findable via [[ too, not just @ (regression: only vault.people was updated)', async () => {
    const user = userEvent.setup()
    render(<Harness initial="" />)

    await type(user, '@Zeb')
    await optionNamed(/create person "Zeb"/)
    await accept(user)
    await waitFor(() => expect(doc()).toBe('[[Zeb]]'))

    await keys(user, ' [[Zeb')
    await optionNamed(/^Zeb/)
  })

  it('does not fetch again while typing after a trigger', async () => {
    const user = userEvent.setup()
    render(<Harness initial="" />)

    // One round of vault lists on mount, before any key is pressed.
    await waitFor(() => expect(getPeople).toHaveBeenCalledTimes(1))
    expect(getPages).toHaveBeenCalledTimes(1)

    await type(user, '@Augus')
    await optionNamed(/Augusto/)
    await user.keyboard('{Escape}')
    await user.keyboard('{Enter}')
    await keys(user, '[[Writ')
    await optionNamed(/Write project README/)

    // Filtering happens in the browser over the cached lists — the counts must not have moved.
    expect(getPeople).toHaveBeenCalledTimes(1)
    expect(getPages).toHaveBeenCalledTimes(1)
  })
})

import { EditorView } from '@codemirror/view'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { MarkdownEditor } from './MarkdownEditor'

/**
 * Mirrors how EditModal drives the editor: the value it hands back through `onChange` is exactly
 * what would reach `setBody`/`replaceBody`, so asserting on `data-testid="outward"` asserts on the
 * text that would be saved to the vault.
 */
function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <MarkdownEditor value={value} onChange={setValue} onSave={() => {}} placeholder="Notes (markdown)" />
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
async function type(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(editor())
  for (const char of text) {
    await user.keyboard(char.replace(/[{[]/g, '$&$&'))
  }
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

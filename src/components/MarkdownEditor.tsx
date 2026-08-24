import { markdown } from '@codemirror/lang-markdown'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view'
import { minimalSetup } from 'codemirror'
import { useEffect, useRef } from 'react'

/**
 * Only tokens from src/styles/app.css — no CodeMirror palette leaks in.
 *
 * `.cm-content span { color: inherit }` is the one non-obvious rule: `minimalSetup` ships
 * `defaultHighlightStyle` as a fallback highlighter, a light-theme palette whose colours are not
 * app tokens (dark green headings, purple keywords on #131313). Its rules are emitted as bare
 * generated single-class selectors, so this rule outranks all of them on specificity and drops
 * every syntax colour while leaving the weight/style ones (bold heading, italic emphasis) intact —
 * the monochrome look the textarea had.
 *
 * Note for the wikilink/checklist decorations coming next: this rule is (0,2,1), so a decoration
 * mark styled here as `.cm-foo` (0,2,0) would lose to it. Style decoration spans as
 * `.cm-content span.cm-foo` (0,2,2) and they win.
 */
const editorTheme = EditorView.theme(
  {
    '&': {
      background: 'var(--color-bg)',
      color: 'var(--color-ink)',
      border: '1px solid var(--color-line)',
      borderRadius: 'var(--radius-card)',
      fontFamily: 'var(--font-mono)',
      fontSize: '12.5px',
    },
    '&.cm-focused': {
      outline: 'none',
      borderColor: 'color-mix(in srgb, var(--color-accent) 60%, transparent)',
    },
    '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.625' },
    '.cm-content': {
      padding: '10px 14px',
      minHeight: '163px', // 8 rows x 1.625 leading x 12.5px — the rows={8} textarea this replaces
      caretColor: 'var(--color-accent)',
    },
    '.cm-line': { padding: '0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': {
      background: 'var(--color-accent-soft)',
    },
    '.cm-content span': { color: 'inherit' },
    '.cm-content .cm-placeholder': { color: 'var(--color-ink-faint)' },
  },
  { dark: true },
)

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  /** Ctrl/Cmd+Enter — the save shortcut the textarea carried. */
  onSave: () => void
  placeholder?: string
  className?: string
}

/** Controlled CodeMirror 6 editor: same `value`/`onChange` contract as the textarea it replaces. */
export function MarkdownEditor({ value, onChange, onSave, placeholder = '', className }: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  // Handlers are read through refs so the extension set is built once: rebuilding it on every
  // parent render would tear down the editor (and the cursor) on each keystroke.
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  onChangeRef.current = onChange
  onSaveRef.current = onSave

  // Mount-only: `value` seeds the document here and is kept in sync by the effect below.
  const initial = useRef(value)
  const initialPlaceholder = useRef(placeholder)

  useEffect(() => {
    const v = new EditorView({
      parent: host.current ?? undefined,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          minimalSetup,
          markdown(),
          EditorView.lineWrapping,
          // CodeMirror renders the placeholder as aria-placeholder, which is not an accessible-name
          // source — so the label has to be set too, or the textbox ends up nameless where the
          // textarea's placeholder used to name it.
          ...(initialPlaceholder.current
            ? [
                placeholderExt(initialPlaceholder.current),
                EditorView.contentAttributes.of({ 'aria-label': initialPlaceholder.current }),
              ]
            : []),
          editorTheme,
          // defaultKeymap binds Mod-Enter to insertBlankLine, so save has to outrank it.
          Prec.highest(
            keymap.of([
              {
                key: 'Mod-Enter',
                run: () => {
                  onSaveRef.current()
                  return true
                },
              },
            ]),
          ),
          EditorView.updateListener.of(u => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
  }, [])

  // Adopt values pushed in from outside (fetch, Improve, discard-changes). The guard makes the
  // user's own keystrokes a no-op here, so the cursor only moves when the parent really replaced
  // the text.
  useEffect(() => {
    const v = view.current
    if (v && value !== v.state.doc.toString()) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
    }
  }, [value])

  return <div ref={host} className={className} />
}

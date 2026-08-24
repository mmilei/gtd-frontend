import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState, Prec, RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView, keymap, placeholder as placeholderExt, type DecorationSet } from '@codemirror/view'
import { minimalSetup } from 'codemirror'
import { useEffect, useRef } from 'react'
import { getPages, getPeople } from '../lib/api'
import type { VaultPage } from '../lib/types'

/** `[[Target]]` on a single line — no nesting, no empty target. */
const WIKILINK = /\[\[[^[\]\n]+\]\]/g

const wikilinkMark = Decoration.mark({ class: 'cm-wikilink' })
/** Empty replacement: the brackets stop being rendered, the text stays in `state.doc`. */
const hiddenBrackets = Decoration.replace({})

// ponytail: rescans the whole document on every transaction — note bodies are a few KB, so the
// viewport-ranged scan CodeMirror recommends for large files would be complexity with no payoff.
function wikilinkDecorations(state: EditorState): DecorationSet {
  const cursorLine = state.doc.lineAt(state.selection.main.head).number
  const builder = new RangeSetBuilder<Decoration>()
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n)
    WIKILINK.lastIndex = 0
    for (let m = WIKILINK.exec(line.text); m; m = WIKILINK.exec(line.text)) {
      const from = line.from + m.index
      const to = from + m[0].length
      if (n === cursorLine) {
        // the line being edited stays verbatim, only tinted — hiding the brackets under the cursor
        // is what makes an editor feel like it is fighting you
        builder.add(from, to, wikilinkMark)
      } else {
        builder.add(from, from + 2, hiddenBrackets)
        builder.add(from + 2, to - 2, wikilinkMark)
        builder.add(to - 2, to, hiddenBrackets)
      }
    }
  }
  return builder.finish()
}

/**
 * Obsidian-style wikilink rendering: `[[Target]]` shows as `Target` unless the cursor is on its line.
 *
 * Purely visual — decorations are a view-layer overlay and never touch `state.doc`, so the body that
 * reaches `onChange` (and from there `setBody`/save) always carries the full `[[Target]]` source.
 * A StateField rather than a ViewPlugin: no subscriptions, so nothing to tear down in a `destroy()`.
 */
const wikilinks = StateField.define<DecorationSet>({
  create: wikilinkDecorations,
  update: (_deco, tr) => wikilinkDecorations(tr.state),
  provide: f => EditorView.decorations.from(f),
})

/**
 * Selecting a person (`@`) or a page (`[[`) always writes a `[[Name]]` wikilink.
 *
 * `from` is the position after the trigger — that is what CodeMirror filters the typed text
 * against — so the insert has to reach back over the trigger itself to swallow it.
 */
function insertWikilink(view: EditorView, completion: Completion, from: number, to: number) {
  const trigger = view.state.sliceDoc(Math.max(0, from - 2), from) === '[[' ? 2 : 1
  const insert = `[[${completion.label}]]`
  view.dispatch({
    changes: { from: from - trigger, to, insert },
    selection: { anchor: from - trigger + insert.length },
    userEvent: 'input.complete',
  })
}

const asLinkOptions = (pages: VaultPage[]): Completion[] =>
  pages.map(p => ({ label: p.name, detail: p.kind.toLowerCase(), apply: insertWikilink }))

interface VaultOptions {
  people: Completion[]
  pages: Completion[]
}

/**
 * The three triggers, resolved entirely against data already in memory — the vault lists are
 * fetched once when the editor mounts and tags come in as a prop, so no keystroke can reach the
 * network. Returning `validFor` lets CodeMirror keep refiltering the same option array in the
 * browser instead of even calling this source again on the following characters.
 */
function suggest(ctx: CompletionContext, vault: VaultOptions, tags: string[]): CompletionResult | null {
  const page = ctx.matchBefore(/\[\[[^[\]\n]*/)
  if (page) return { from: page.from + 2, options: vault.pages, validFor: /^[^[\]\n]*$/ }

  const person = ctx.matchBefore(/@[^\s[\]@]*/)
  if (person) return { from: person.from + 1, options: vault.people, validFor: /^[^\s[\]@]*$/ }

  // A bare `#` is a markdown heading, so a tag only starts once there is something after it.
  const tag = ctx.matchBefore(/#[\w-]+/)
  if (tag) return { from: tag.from + 1, options: tags.map(label => ({ label })), validFor: /^[\w-]*$/ }

  return null
}

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
    // (0,2,2) — outranks the `.cm-content span` reset above, per the note there
    '.cm-content span.cm-wikilink': { color: 'var(--color-accent)' },
    '.cm-content .cm-placeholder': { color: 'var(--color-ink-faint)' },
    // Suggestion dropdown — same card surface as the modal's own controls, not CodeMirror's
    // default light-grey list.
    '.cm-tooltip.cm-tooltip-autocomplete': {
      background: 'var(--color-raised)',
      border: '1px solid var(--color-line-strong)',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
    },
    '.cm-tooltip-autocomplete > ul': {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      maxHeight: '13em',
    },
    '.cm-tooltip-autocomplete > ul > li': {
      padding: '3px 10px',
      color: 'var(--color-ink-muted)',
      lineHeight: '1.6',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      background: 'var(--color-accent-soft)',
      color: 'var(--color-ink)',
    },
    '.cm-completionMatchedText': { textDecoration: 'none', color: 'var(--color-accent)' },
    '.cm-completionDetail': { marginLeft: '0.75em', color: 'var(--color-ink-faint)', fontStyle: 'normal' },
  },
  { dark: true },
)

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  /** Ctrl/Cmd+Enter — the save shortcut the textarea carried. */
  onSave: () => void
  /** Tags the app already has in memory, offered after `#`. */
  tagSuggestions?: string[]
  placeholder?: string
  className?: string
}

/** Controlled CodeMirror 6 editor: same `value`/`onChange` contract as the textarea it replaces. */
export function MarkdownEditor({ value, onChange, onSave, tagSuggestions = [], placeholder = '', className }: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const vault = useRef<VaultOptions>({ people: [], pages: [] })
  const tagsRef = useRef(tagSuggestions)
  tagsRef.current = tagSuggestions

  // The only network call this component makes: one round of vault lists per mount, read through a
  // ref by the completion source. Typing after a trigger filters that cached array in the browser.
  useEffect(() => {
    let cancelled = false
    void Promise.all([getPeople(), getPages()])
      .then(([people, pages]) => {
        if (!cancelled) vault.current = { people: asLinkOptions(people), pages: asLinkOptions(pages) }
      })
      .catch(() => {
        // No suggestions is a fine degraded state — the editor itself keeps working.
      })
    return () => {
      cancelled = true
    }
  }, [])
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
          wikilinks,
          autocompletion({
            icons: false,
            override: [ctx => suggest(ctx, vault.current, tagsRef.current)],
          }),
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

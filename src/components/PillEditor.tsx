import { X } from 'lucide-react'
import { useId, useState } from 'react'

interface Props {
  values: string[]
  placeholder: string
  suggestions?: string[]
  normalize?: (raw: string) => string
  onAdd: (value: string) => void
  onRemove: (value: string) => void
}

/** Shared pill-list editor for tags and related people. Enter/comma adds, backspace removes last. */
export function PillEditor({ values, placeholder, suggestions, normalize, onAdd, onRemove }: Props) {
  const [draft, setDraft] = useState('')
  const listId = useId()

  function commit() {
    const clean = (normalize ?? ((s: string) => s.trim()))(draft.replace(/,/g, ''))
    if (clean) onAdd(clean)
    setDraft('')
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-card border border-line bg-bg px-2.5 py-1.5">
      {values.map(v => (
        <span key={v} className="flex items-center gap-1 rounded-full bg-raised px-2.5 py-0.5 text-[11.5px] text-ink">
          {v}
          <button onClick={() => onRemove(v)} aria-label={`Remove ${v}`} className="text-ink-faint hover:text-discard">
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Tab' && draft.trim()) {
            // Commit the typed pill instead of tabbing away and losing it — but keep focus here
            // so the user can keep adding pills with Tab. Empty draft falls through to normal tabbing.
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
            onRemove(values[values.length - 1])
          } else if (e.key === 'Escape' && draft !== '') {
            // Only consume Escape when there's a draft to clear — first Escape cancels the
            // in-progress pill, second Escape (now with an empty draft) bubbles up to Overlay
            // and closes the modal. An empty draft has nothing to clear, so let it bubble
            // immediately instead of eating the modal's close on the first press.
            e.stopPropagation()
            setDraft('')
          }
        }}
        onBlur={() => draft.trim() && commit()}
        placeholder={placeholder}
        list={suggestions ? listId : undefined}
        className="min-w-24 flex-1 bg-transparent py-0.5 text-[12px] text-ink placeholder:text-ink-faint focus:outline-none"
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map(s => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  )
}

import { Layers } from 'lucide-react'
import { SYSTEM_TAGS } from '../lib/types'
import type { Item } from '../lib/types'

interface Props {
  items: Item[]
  selected: Set<string>
  onToggle: (tag: string, additive: boolean) => void
  /** Opens the cross-bucket FacetView for a tag — distinct from the within-bucket filter `onToggle` drives. */
  onViewAcross: (tag: string) => void
}

/** Context-tag filter. Click = solo filter, shift+click = AND filter; the layers icon opens it across all buckets. */
export function TagBar({ items, selected, onToggle, onViewAcross }: Props) {
  const tally = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      if (!SYSTEM_TAGS.has(tag)) tally.set(tag, (tally.get(tag) ?? 0) + 1)
    }
  }
  if (tally.size === 0) return null

  const tags = [...tally.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      {tags.map(([tag, count]) => {
        const isActive = selected.has(tag)
        return (
          <span
            key={tag}
            className={`group flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-[11px] transition-colors ${
              isActive
                ? 'border-accent/50 bg-accent-soft text-accent'
                : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
            }`}
          >
            <button onClick={e => onToggle(tag, e.shiftKey)} className="flex items-center gap-1.5">
              {tag}
              <span className="font-mono text-[10px] tabular-nums opacity-60">{count}</span>
            </button>
            <button
              onClick={() => onViewAcross(tag)}
              title={`View #${tag} across all buckets`}
              aria-label={`View #${tag} across all buckets`}
              className="rounded-full p-0.5 text-ink-faint opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Layers size={11} />
            </button>
          </span>
        )
      })}
    </div>
  )
}

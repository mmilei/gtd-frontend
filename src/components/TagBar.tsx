import { SYSTEM_TAGS } from '../lib/types'
import type { Item } from '../lib/types'

interface Props {
  items: Item[]
  selected: Set<string>
  onToggle: (tag: string, additive: boolean) => void
}

/** Context-tag filter. Click = solo filter, shift+click = AND filter. */
export function TagBar({ items, selected, onToggle }: Props) {
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
          <button
            key={tag}
            onClick={e => onToggle(tag, e.shiftKey)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
              isActive
                ? 'border-accent/50 bg-accent-soft text-accent'
                : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
            }`}
          >
            {tag}
            <span className="font-mono text-[10px] tabular-nums opacity-60">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

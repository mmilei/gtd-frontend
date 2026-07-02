import { Play, Search } from 'lucide-react'
import { useState } from 'react'
import { BUCKET_META } from '../lib/bucketMeta'
import { formatMinutes, projectDay } from '../lib/todayOrder'
import type { Bucket, Item } from '../lib/types'
import { ItemCard } from './ItemCard'
import { TagBar } from './TagBar'

interface Props {
  bucket: Bucket
  items: Item[]
  allItems: Item[]
  selectedTags: Set<string>
  onToggleTag: (tag: string, additive: boolean) => void
  onOpenItem: (file: string) => void
  onComplete: (item: Item) => Promise<boolean>
  onDismiss: (item: Item) => Promise<boolean>
  /** Present only for Today — starts a focus session (optionally from a given item). */
  onFocus?: (item?: Item) => void
}

export function ItemList({ bucket, items, allItems, selectedTags, onToggleTag, onOpenItem, onComplete, onDismiss, onFocus }: Props) {
  const meta = BUCKET_META[bucket]
  const [query, setQuery] = useState('')
  const projection = bucket === 'today' ? projectDay(items) : null

  // Reference doubles as the knowledge shelf — it gets a text search on top of tag filters.
  const q = bucket === 'reference' ? query.trim().toLowerCase() : ''
  const visible = q
    ? items.filter(i => (i.title ?? '').toLowerCase().includes(q) || (i.body ?? '').toLowerCase().includes(q))
    : items

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 pt-8 pb-10">
        <div className="mb-3 flex items-baseline gap-3">
          <h1 className="font-display text-[22px] font-semibold tracking-tight" style={{ color: meta.color }}>
            {meta.label}
          </h1>
          <span className="font-mono text-[13px] tabular-nums text-ink-faint">
            {String(visible.length).padStart(2, '0')}
          </span>
          {onFocus && visible.length > 0 && (
            <button
              onClick={() => onFocus()}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-accent/40 px-3 py-1 text-[12px] text-accent transition-colors hover:bg-accent-soft"
            >
              <Play size={12} />
              Focus
            </button>
          )}
          {bucket === 'reference' && (
            <div className="ml-auto flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1">
              <Search size={12} className="text-ink-faint" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search references…"
                spellCheck={false}
                className="w-44 bg-transparent text-[12px] text-ink placeholder:text-ink-faint focus:outline-none"
              />
            </div>
          )}
        </div>

        {projection && (
          <div className="mb-3 font-mono text-[11.5px] text-ink-muted">
            {formatMinutes(projection.totalMinutes)} of estimated work · finishes ~
            <span className="text-today">{projection.finishLabel}</span>
            {projection.unestimatedCount > 0 && (
              <span className="text-ink-faint"> · {projection.unestimatedCount} without estimate</span>
            )}
          </div>
        )}

        <TagBar items={allItems} selected={selectedTags} onToggle={onToggleTag} />

        {visible.length === 0 ? (
          <div className="rounded-card border border-dashed border-line px-6 py-12 text-center text-[13px] text-ink-faint">
            {q
              ? 'No references match your search.'
              : selectedTags.size > 0
                ? `Nothing here matches ${[...selectedTags].map(t => `#${t}`).join(' + ')}`
                : bucket === 'today'
                  ? 'Today is clear. Pull something from the backlog when you’re ready.'
                  : 'Nothing here.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map(item => (
              <ItemCard
                key={item.file}
                item={item}
                bucket={bucket}
                onOpen={onOpenItem}
                onComplete={onComplete}
                onDismiss={onDismiss}
                onFocus={onFocus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

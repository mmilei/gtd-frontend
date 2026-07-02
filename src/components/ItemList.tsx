import { Search } from 'lucide-react'
import { useState } from 'react'
import { BUCKET_META } from '../lib/bucketMeta'
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
  onSendToToday: (item: Item) => Promise<boolean>
}

export function ItemList({ bucket, items, allItems, selectedTags, onToggleTag, onOpenItem, onComplete, onDismiss, onSendToToday }: Props) {
  const meta = BUCKET_META[bucket]
  const [query, setQuery] = useState('')

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
                onSendToToday={onSendToToday}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

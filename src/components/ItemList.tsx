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
  onComplete: (item: Item) => Promise<boolean>
  onDismiss: (item: Item) => Promise<boolean>
  onSendToToday: (item: Item) => Promise<boolean>
}

export function ItemList({ bucket, items, allItems, selectedTags, onToggleTag, onComplete, onDismiss, onSendToToday }: Props) {
  const meta = BUCKET_META[bucket]

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 pt-8 pb-16">
        <div className="mb-3 flex items-baseline gap-3">
          <h1 className="font-display text-[22px] font-semibold tracking-tight" style={{ color: meta.color }}>
            {meta.label}
          </h1>
          <span className="font-mono text-[13px] tabular-nums text-ink-faint">
            {String(items.length).padStart(2, '0')}
          </span>
        </div>

        <TagBar items={allItems} selected={selectedTags} onToggle={onToggleTag} />

        {items.length === 0 ? (
          <div className="rounded-card border border-dashed border-line px-6 py-12 text-center text-[13px] text-ink-faint">
            {selectedTags.size > 0
              ? `Nothing here matches ${[...selectedTags].map(t => `#${t}`).join(' + ')}`
              : bucket === 'today'
                ? 'Today is clear. Pull something from the backlog when you’re ready.'
                : 'Nothing here.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(item => (
              <ItemCard
                key={item.file}
                item={item}
                bucket={bucket}
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

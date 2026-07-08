import { useMemo, useState } from 'react'
import { BUCKET_ORDER } from '../lib/bucketMeta'
import { SYSTEM_TAGS } from '../lib/types'
import type { BucketsMap, Item } from '../lib/types'
import { BucketGroupHeader } from './BucketGroupHeader'
import { Overlay } from './Overlay'

interface Props {
  buckets: BucketsMap
  onOpenItem: (file: string) => void
  onClose: () => void
}

/** Same case-insensitive substring match the Reference list uses, widened to title, body, tags, and project. */
function matches(item: Item, q: string): boolean {
  if ((item.title ?? '').toLowerCase().includes(q)) return true
  if ((item.body ?? '').toLowerCase().includes(q)) return true
  if ((item.project ?? '').toLowerCase().includes(q)) return true
  return (item.tags ?? []).some(t => t.toLowerCase().includes(q))
}

/** Global search across every bucket — the full in-memory dataset, not just the active list. */
export function SearchOverlay({ buckets, onOpenItem, onClose }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const groups = useMemo(() => {
    if (!q) return []
    return BUCKET_ORDER.map(bucket => ({
      bucket,
      items: (buckets[bucket] ?? []).filter(i => matches(i, q)),
    })).filter(g => g.items.length > 0)
  }, [buckets, q])

  const total = groups.reduce((n, g) => n + g.items.length, 0)

  function open(file: string) {
    onOpenItem(file)
    onClose()
  }

  return (
    <Overlay title="Search" onClose={onClose} wide>
      <div className="flex flex-col gap-4 p-5">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          spellCheck={false}
          placeholder="Search all buckets by title, notes, tag, or project…"
          className="rounded-card border border-line bg-bg px-3.5 py-2 text-[14px] text-ink placeholder:text-ink-faint focus:border-accent/60 focus:outline-none"
        />

        {q && (
          <div className="font-mono text-[11px] text-ink-faint">
            {total === 0 ? 'No matches' : `${total} match${total === 1 ? '' : 'es'}`}
          </div>
        )}

        {groups.map(({ bucket, items }) => (
          <div key={bucket} className="flex flex-col gap-1.5">
            <BucketGroupHeader bucket={bucket} count={items.length} />
            <div className="flex flex-col gap-1">
              {items.map(item => {
                const tags = (item.tags ?? []).filter(t => !SYSTEM_TAGS.has(t))
                return (
                  <button
                    key={item.file}
                    onClick={() => open(item.file)}
                    className="flex flex-col gap-0.5 rounded-card border border-line bg-surface px-3.5 py-2 text-left transition-colors hover:border-line-strong"
                  >
                    <span className="truncate text-[13px] text-ink">{item.title ?? item.file}</span>
                    <span className="flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] text-ink-faint">
                      {item.project && <span className="text-accent">◆ {item.project}</span>}
                      {tags.length > 0 && <span>{tags.map(t => `#${t}`).join(' ')}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Overlay>
  )
}

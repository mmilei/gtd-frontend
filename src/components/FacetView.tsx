import { useMemo } from 'react'
import { BUCKET_ORDER } from '../lib/bucketMeta'
import { itemMatches } from '../lib/facets'
import type { BucketsMap, Facet, Item } from '../lib/types'
import { BucketGroupHeader } from './BucketGroupHeader'
import { ItemCard } from './ItemCard'
import { overlayFrame } from './Overlay'
import type { Frame } from './Overlay'

interface Props {
  facet: Facet
  value: string
  buckets: BucketsMap
  onOpenItem: (file: string) => void
  onOpenProject: (project: string) => void
  onOpenLocation: (location: string) => void
  onComplete: (item: Item) => Promise<boolean>
  onDismiss: (item: Item) => Promise<boolean>
  onClose: () => void
  /** Surface to render into — the modal dialog unless a standalone page frame is passed. */
  frame?: Frame
}

const FACET_PREFIX: Record<Facet, string> = { tag: '#', project: '◆ ', location: '📍 ', area: '▣ ' }

/** One reusable cross-bucket view: everything matching facet+value, grouped by bucket. */
export function FacetView({ facet, value, buckets, onOpenItem, onOpenProject, onOpenLocation, onComplete, onDismiss, onClose, frame = overlayFrame }: Props) {
  const groups = useMemo(
    () =>
      BUCKET_ORDER.map(bucket => ({
        bucket,
        items: (buckets[bucket] ?? []).filter(i => itemMatches(i, facet, value)),
      })).filter(g => g.items.length > 0),
    [buckets, facet, value],
  )

  const total = groups.reduce((n, g) => n + g.items.length, 0)

  return frame({
    title: `${FACET_PREFIX[facet]}${value}`,
    onClose,
    children: (
      <div className="flex flex-col gap-5 p-5">
        <div className="font-mono text-[11px] text-ink-faint">
          {total} item{total === 1 ? '' : 's'} across {groups.length} bucket{groups.length === 1 ? '' : 's'}
        </div>

        {groups.map(({ bucket, items }) => (
          <div key={bucket} className="flex flex-col gap-2">
            <BucketGroupHeader bucket={bucket} count={items.length} />
            <div className="flex flex-col gap-2">
              {items.map(item => (
                <ItemCard
                  key={item.file}
                  item={item}
                  bucket={bucket}
                  onOpen={onOpenItem}
                  onOpenProject={onOpenProject}
                  onOpenLocation={onOpenLocation}
                  onComplete={onComplete}
                  onDismiss={onDismiss}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  })
}

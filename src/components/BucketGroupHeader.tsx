import { BUCKET_META } from '../lib/bucketMeta'
import type { Bucket } from '../lib/types'

/** Shared bucket-group label (icon · name · count) for the cross-bucket overlays (Search, Facet). */
export function BucketGroupHeader({ bucket, count }: { bucket: Bucket; count: number }) {
  const meta = BUCKET_META[bucket]
  return (
    <div className="flex items-center gap-1.5">
      <meta.Icon size={12} style={{ color: meta.color }} className="opacity-80" />
      <span className="font-mono text-[10.5px] tracking-wide text-ink-faint uppercase">{meta.label}</span>
      <span className="font-mono text-[10.5px] tabular-nums text-ink-faint opacity-60">{count}</span>
    </div>
  )
}

import { FolderGit2 } from 'lucide-react'
import { BUCKET_META, BUCKET_ORDER } from '../lib/bucketMeta'
import type { Bucket, BucketsMap } from '../lib/types'

interface Props {
  buckets: BucketsMap
  active: Bucket
  onSelect: (bucket: Bucket) => void
  /** Distinct project names, cross-bucket — each opens a project FacetView. */
  projects: string[]
  onOpenProject: (project: string) => void
}

export function BucketRail({ buckets, active, onSelect, projects, onOpenProject }: Props) {
  return (
    <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-surface p-2" aria-label="Buckets">
      {BUCKET_ORDER.map(bucket => {
        const { label, color, Icon } = BUCKET_META[bucket]
        const count = buckets[bucket]?.length ?? 0
        const isActive = bucket === active
        return (
          <button
            key={bucket}
            onClick={() => onSelect(bucket)}
            aria-current={isActive ? 'page' : undefined}
            className={`group flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
              isActive ? 'bg-raised text-ink' : 'text-ink-muted hover:bg-raised/60 hover:text-ink'
            }`}
          >
            <Icon size={14} strokeWidth={2} style={{ color: isActive ? color : undefined }} className="shrink-0 opacity-80" />
            <span className="flex-1">{label}</span>
            <span className={`font-mono text-[11px] tabular-nums ${isActive ? 'text-ink-muted' : 'text-ink-faint'}`}>
              {count}
            </span>
          </button>
        )
      })}

      {projects.length > 0 && (
        <>
          <div className="mx-3 mt-3 mb-1 flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-ink-faint uppercase">
            <FolderGit2 size={11} className="opacity-80" />
            Projects
          </div>
          {projects.map(project => (
            <button
              key={project}
              onClick={() => onOpenProject(project)}
              title={`View ${project} across all buckets`}
              className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[12.5px] text-ink-muted transition-colors hover:bg-raised/60 hover:text-ink"
            >
              <span className="truncate">{project}</span>
            </button>
          ))}
        </>
      )}
    </nav>
  )
}

import { AREA_OPTIONS } from '../lib/types'

interface Props {
  /** Opens the cross-bucket FacetView for the clicked life area. */
  onOpenArea: (area: string) => void
}

/**
 * Always-visible filter for the fixed closed vocabulary of life areas. Unlike Projects
 * (data-derived), all 8 areas render regardless of whether any item currently uses them.
 */
export function AreaBar({ onOpenArea }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface/60 px-6 py-2">
      <span className="mr-1 font-mono text-[10px] tracking-wide text-ink-faint uppercase">Areas</span>
      {AREA_OPTIONS.map(area => (
        <button
          key={area}
          onClick={() => onOpenArea(area)}
          title={`View ${area} across all buckets`}
          className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-ink-muted transition-colors hover:border-accent/50 hover:text-ink"
        >
          {area}
        </button>
      ))}
    </div>
  )
}

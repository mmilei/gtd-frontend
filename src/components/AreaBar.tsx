interface Props {
  /** The backend's configured area vocabulary (GET /api/areas) — empty while loading. */
  areas: string[]
  /** Opens the cross-bucket FacetView for the clicked life area. */
  onOpenArea: (area: string) => void
}

/**
 * Always-visible filter for the closed vocabulary of life areas. Unlike Projects (data-derived),
 * every configured area renders regardless of whether any item currently uses it. Renders
 * nothing until the vocabulary arrives — no flash of a wrong/empty vocabulary.
 */
export function AreaBar({ areas, onOpenArea }: Props) {
  if (areas.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface/60 px-6 py-2">
      <span className="mr-1 font-mono text-[10px] tracking-wide text-ink-faint uppercase">Areas</span>
      {areas.map(area => (
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

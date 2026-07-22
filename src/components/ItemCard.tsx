import { Check, Play, X } from 'lucide-react'
import { useState } from 'react'
import { playBoink, playThunk } from '../lib/sound'
import { formatMinutes } from '../lib/todayOrder'
import { SYSTEM_TAGS } from '../lib/types'
import type { Bucket, Item } from '../lib/types'

interface Props {
  item: Item
  bucket: Bucket
  onOpen: (file: string) => void
  /** Open the cross-bucket facet view for this item's project / location. */
  onOpenProject?: (project: string) => void
  onOpenLocation?: (location: string) => void
  onComplete: (item: Item) => Promise<boolean>
  onDismiss: (item: Item) => Promise<boolean>
  /** Present only in Today — starts a focus session on this item. */
  onFocus?: (item: Item) => void
}

function bodySnippet(body?: string): string {
  if (!body) return ''
  const line = body.split('\n').find(l => l.trim() && !/^#+\s/.test(l) && !/^[-*]\s/.test(l))
  if (!line) return ''
  const t = line.trim()
  return t.slice(0, 80) + (t.length > 80 ? '…' : '')
}

/**
 * Creation date for read-only display in any list. The backend stores `created` as a date but may
 * hand back a full ISO datetime — normalize to YYYY-MM-DD so every list renders it identically.
 * Shared with TriageOverlay so the two never drift.
 */
export function formatCreated(created: string): string {
  return created.slice(0, 10)
}

/** Days the item has been sitting in Today. Informational, never alarmed. */
function daysInToday(item: Item, bucket: Bucket): number {
  if (bucket !== 'today' || !item.today_since) return 0
  return Math.floor((Date.now() - new Date(item.today_since).getTime()) / 86_400_000)
}

export function ItemCard({ item, bucket, onOpen, onOpenProject, onOpenLocation, onComplete, onDismiss, onFocus }: Props) {
  const [leaving, setLeaving] = useState(false)

  async function run(e: React.MouseEvent, action: (i: Item) => Promise<boolean>, sound?: () => void) {
    e.stopPropagation()
    sound?.()
    setLeaving(true)
    const ok = await action(item)
    if (!ok) setLeaving(false)
  }

  // Only open on Enter/Space when the card itself is focused — a descendant button's own
  // keydown bubbles here too, and Check/Focus/Dismiss already handle their own activation.
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(item.file)
    }
  }

  const title = item.title ?? item.file
  const tags = (item.tags ?? []).filter(t => !SYSTEM_TAGS.has(t))
  const snippet = bodySnippet(item.body)
  const age = daysInToday(item, bucket)
  const people = item.delegado_a ?? []
  const project = item.project?.trim()
  const location = item.location?.trim()

  return (
    <div
      onClick={() => onOpen(item.file)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Open "${title}"`}
      className={`group cursor-pointer rounded-card border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        leaving ? 'animate-card-out' : 'animate-fade-up'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={e => run(e, onComplete, playBoink)}
          title="Mark as done"
          aria-label={`Mark "${title}" as done`}
          className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border border-line-strong text-transparent transition-colors hover:border-done hover:text-done"
        >
          <Check size={11} strokeWidth={2.5} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] leading-snug text-ink">{title}</div>
          {(project || location) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {project && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    onOpenProject?.(project)
                  }}
                  disabled={!onOpenProject}
                  title={`View project ${project}`}
                  className="rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-[10.5px] text-accent transition-colors enabled:hover:border-accent/60 disabled:cursor-default"
                >
                  ◆ {project}
                </button>
              )}
              {location && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    onOpenLocation?.(location)
                  }}
                  disabled={!onOpenLocation}
                  title={`View location ${location}`}
                  className="rounded-full border border-today/30 bg-today/10 px-2 py-0.5 text-[10.5px] text-today transition-colors enabled:hover:border-today/60 disabled:cursor-default"
                >
                  📍 {location}
                </button>
              )}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-faint">
            {item.created && (
              <span title={`Created ${formatCreated(item.created)}`} aria-label={`Created ${formatCreated(item.created)}`}>
                {formatCreated(item.created)}
              </span>
            )}
            {item.due && <span className="text-waiting">due {item.due}</span>}
            {item.estimate_minutes != null && <span className="text-today">~{formatMinutes(item.estimate_minutes)}</span>}
            {people.length > 0 && <span>{people.map(p => `@${p}`).join(' ')}</span>}
            {age >= 2 && <span className="text-ink-muted">{age}d in today</span>}
          </div>
          {snippet && <div className="mt-1.5 truncate text-[12px] text-ink-muted">{snippet}</div>}
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map(t => (
                <span key={t} className="rounded-full bg-raised px-2 py-0.5 text-[10.5px] text-ink-muted">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {onFocus && (
            <button
              onClick={e => {
                e.stopPropagation()
                onFocus(item)
              }}
              title="Focus on this task"
              aria-label={`Focus on "${title}"`}
              className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-raised hover:text-accent"
            >
              <Play size={14} />
            </button>
          )}
          <button
            onClick={e => run(e, onDismiss, playThunk)}
            title="Dismiss"
            aria-label={`Dismiss "${title}"`}
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-raised hover:text-discard"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

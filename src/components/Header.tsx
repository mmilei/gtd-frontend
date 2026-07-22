import { BadgeCheck, CalendarCheck, History, Play, Search } from 'lucide-react'
import type { ApiStatus } from '../state/useBuckets'
import { ProviderMenu } from './ProviderMenu'

const TODAY_LABEL = new Date().toLocaleDateString('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

interface Props {
  apiStatus: ApiStatus
  onOpenSearch: () => void
  onOpenTriage: () => void
  onOpenReview: () => void
  onOpenHistory: () => void
  onOpenUnconfirmed: () => void
  /** Number of low-confidence captures awaiting review — drives the badge on the Unconfirmed button. */
  unconfirmedCount: number
}

export function Header({ apiStatus, onOpenSearch, onOpenTriage, onOpenReview, onOpenHistory, onOpenUnconfirmed, unconfirmedCount }: Props) {
  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-line bg-surface px-5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[15px] font-semibold tracking-tight">GTD Brain</span>
        <span className="font-mono text-[11px] text-ink-faint">{TODAY_LABEL}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenSearch}
          title="Search all buckets"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <Search size={13} />
          Search
          <kbd className="rounded border border-line px-1 font-mono text-[10px] text-ink-faint">⌘K</kbd>
        </button>
        <button
          onClick={onOpenTriage}
          title="Triage backlog"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <Play size={13} />
          Triage
        </button>
        <button
          onClick={onOpenReview}
          title="Weekly review"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <CalendarCheck size={13} />
          Review
        </button>
        <button
          onClick={onOpenHistory}
          title="Durable history — every create, move, done, dismiss, and undo"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <History size={13} />
          History
        </button>
        {unconfirmedCount > 0 && (
          <button
            onClick={onOpenUnconfirmed}
            title={`Review ${unconfirmedCount} low-confidence capture${unconfirmedCount === 1 ? '' : 's'}`}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <BadgeCheck size={13} />
            Unconfirmed
            <span className="rounded-full bg-accent px-1.5 font-mono text-[10px] leading-[1.4] text-bg">{unconfirmedCount}</span>
          </button>
        )}
        <div className="mx-1 h-4 w-px bg-line" aria-hidden />
        <ProviderMenu apiStatus={apiStatus} />
      </div>
    </header>
  )
}

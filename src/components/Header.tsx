import { CalendarCheck, Play } from 'lucide-react'
import type { ApiStatus } from '../state/useBuckets'
import { ProviderMenu } from './ProviderMenu'

const TODAY_LABEL = new Date().toLocaleDateString('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

interface Props {
  apiStatus: ApiStatus
  onOpenTriage: () => void
  onOpenReview: () => void
}

export function Header({ apiStatus, onOpenTriage, onOpenReview }: Props) {
  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-line bg-surface px-5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[15px] font-semibold tracking-tight">GTD Brain</span>
        <span className="font-mono text-[11px] text-ink-faint">{TODAY_LABEL}</span>
      </div>
      <div className="flex items-center gap-1.5">
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
        <div className="mx-1 h-4 w-px bg-line" aria-hidden />
        <ProviderMenu apiStatus={apiStatus} />
      </div>
    </header>
  )
}

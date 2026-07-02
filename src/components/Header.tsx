import type { ApiStatus } from '../state/useBuckets'

const STATUS_LABEL: Record<ApiStatus, string> = {
  connecting: 'Connecting…',
  online: 'API online',
  offline: 'API offline',
}

const STATUS_COLOR: Record<ApiStatus, string> = {
  connecting: 'bg-waiting',
  online: 'bg-done',
  offline: 'bg-discard',
}

const TODAY_LABEL = new Date().toLocaleDateString('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

export function Header({ apiStatus }: { apiStatus: ApiStatus }) {
  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-line bg-surface px-5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[15px] font-semibold tracking-tight">GTD Brain</span>
        <span className="font-mono text-[11px] text-ink-faint">{TODAY_LABEL}</span>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-ink-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[apiStatus]}`} aria-hidden />
        {STATUS_LABEL[apiStatus]}
      </div>
    </header>
  )
}

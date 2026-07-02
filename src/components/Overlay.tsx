import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** Extra header content rendered between the title and the close button. */
  headerExtra?: ReactNode
  wide?: boolean
}

/** The single surface pattern for modal flows (edit, triage, review). */
export function Overlay({ title, onClose, children, headerExtra, wide = false }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 p-4 pt-[8vh]"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`flex max-h-[84vh] w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} animate-fade-up flex-col overflow-hidden rounded-card border border-line bg-surface shadow-2xl`}
        role="dialog"
        aria-label={title}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
          <span className="font-display text-[14px] font-semibold tracking-tight">{title}</span>
          <div className="flex-1">{headerExtra}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

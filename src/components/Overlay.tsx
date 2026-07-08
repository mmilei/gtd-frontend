import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** Extra header content rendered between the title and the close button. */
  headerExtra?: ReactNode
  wide?: boolean
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/** The single surface pattern for modal flows (edit, triage, review). */
export function Overlay({ title, onClose, children, headerExtra, wide = false }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      // Trap Tab inside the dialog — without this, Tab walks straight out into the
      // still-interactive background (there's no portal here to inert it separately).
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    // If a child already grabbed focus via autoFocus (e.g. a search input), don't
    // override it with the first focusable element in DOM order (the close button,
    // which always renders before the content).
    if (dialog && !dialog.contains(document.activeElement)) {
      dialog.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    }
    return () => previouslyFocused?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 p-4 pt-[8vh]"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={`flex max-h-[84vh] w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} animate-fade-up flex-col overflow-hidden rounded-card border border-line bg-surface shadow-2xl`}
        role="dialog"
        aria-modal="true"
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

import { X } from 'lucide-react'
import { EditModal } from './EditModal'
import type { EditProps } from './EditModal'
import type { Frame } from './Overlay'

/**
 * Standalone-page surface: same title bar and close affordance as the modal Overlay, but in the
 * document flow next to the header and bucket rail instead of floating over the list.
 */
export const pageFrame: Frame = ({ title, onClose, children }) => (
  <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
    <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
      <span className="font-display text-[14px] font-semibold tracking-tight">{title}</span>
      <div className="flex-1" />
      <button
        onClick={onClose}
        aria-label="Close"
        className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-raised hover:text-ink"
      >
        <X size={15} />
      </button>
    </div>
    <div className="w-full max-w-2xl">{children}</div>
  </main>
)

/** A card reached by URL rather than from inside the app: the editor as a page, not a modal. */
export function CardPage(props: Omit<EditProps, 'frame'>) {
  return <EditModal {...props} frame={pageFrame} />
}

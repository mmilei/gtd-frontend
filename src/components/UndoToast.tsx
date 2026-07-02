import { RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { undo } from '../lib/api'

const TOAST_MS = 6000

export interface UndoToastState {
  message: string
  /** Monotonic id so a new toast restarts the timer. */
  id: number
}

export function useUndoToast(onUndone: () => void) {
  const [toast, setToast] = useState<UndoToastState | null>(null)
  const nextId = useRef(0)

  const show = useCallback((message: string) => {
    nextId.current += 1
    setToast({ message, id: nextId.current })
  }, [])

  const dismiss = useCallback(() => setToast(null), [])

  const runUndo = useCallback(async () => {
    setToast(null)
    try {
      await undo()
      onUndone()
    } catch {
      // nothing to undo or backend unavailable — refresh keeps the UI honest
      onUndone()
    }
  }, [onUndone])

  return { toast, show, dismiss, runUndo }
}

interface Props {
  toast: UndoToastState | null
  onUndo: () => void
  onDismiss: () => void
}

export function UndoToast({ toast, onUndo, onDismiss }: Props) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onDismiss, TOAST_MS)
    return () => clearTimeout(id)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 animate-fade-up items-center gap-3 rounded-full border border-line bg-raised py-2 pr-2 pl-4 shadow-xl">
      <span className="max-w-xs truncate text-[12.5px] text-ink">{toast.message}</span>
      <button
        onClick={onUndo}
        className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[12px] text-accent transition-colors hover:bg-accent/25"
      >
        <RotateCcw size={12} />
        Undo
      </button>
    </div>
  )
}

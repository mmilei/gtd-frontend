import { useCallback, useEffect, useRef, useState } from 'react'
import { confirmItem, dismissItem, getUnconfirmed } from '../lib/api'
import { SYSTEM_TAGS } from '../lib/types'
import type { Item } from '../lib/types'
import { Overlay } from './Overlay'

type QueueAction = 'confirm' | 'edit' | 'dismiss'

const ACTIONS: { key: QueueAction; label: string; shortcut: string; className: string }[] = [
  { key: 'confirm', label: 'Confirm', shortcut: '1', className: 'border-done/50 text-done hover:bg-done/10' },
  { key: 'edit', label: 'Edit', shortcut: '2', className: 'border-accent/50 text-accent hover:bg-accent-soft' },
  { key: 'dismiss', label: 'Dismiss', shortcut: '3', className: 'border-discard/50 text-discard hover:bg-discard/10' },
]

interface Props {
  onClose: () => void
  onChanged: () => void
  /** Hand this capture off to the editor (its save confirms it); the queue overlay closes and reopens after. */
  onEdit: (file: string) => void
}

/**
 * Review queue for low-confidence captures (confirmed:false): one item at a time, keyboard-first,
 * summary at the end — the same ritual shape as TriageOverlay. Each item is confirmed as-is,
 * opened in the editor (whose save also confirms), or dismissed.
 */
export function UnconfirmedQueue({ onClose, onChanged, onEdit }: Props) {
  const [queue, setQueue] = useState<Item[] | null>(null)
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const stats = useRef({ confirmed: 0, dismissed: 0 })
  const startedAt = useRef(Date.now())

  useEffect(() => {
    getUnconfirmed()
      .then(items => {
        setQueue(items)
        startedAt.current = Date.now()
      })
      .catch(() => setLoadFailed(true))
  }, [])

  const total = queue?.length ?? 0
  const item = queue && index < total ? queue[index] : null
  const finished = queue !== null && index >= total

  const act = useCallback(
    async (action: QueueAction) => {
      if (!item || busy) return
      // Editing leaves the queue entirely — the editor confirms on save, and reopening refetches
      // so the just-handled item drops out and review resumes with what's left.
      if (action === 'edit') {
        onEdit(item.file)
        return
      }
      setBusy(true)
      try {
        if (action === 'confirm') {
          await confirmItem(item.file)
          stats.current.confirmed++
        } else {
          await dismissItem(item.file)
          stats.current.dismissed++
        }
        setIndex(i => i + 1)
      } catch {
        // action failed — stay on the same item so nothing is silently skipped
      } finally {
        setBusy(false)
      }
    },
    [item, busy, onEdit],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement | null)?.closest('input, textarea')) return
      const idx = ['1', '2', '3'].indexOf(e.key)
      if (idx !== -1) {
        e.preventDefault()
        act(ACTIONS[idx].key)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [act])

  function close() {
    onChanged()
    onClose()
  }

  const elapsedMin = Math.max(1, Math.round((Date.now() - startedAt.current) / 60_000))
  const tags = (item?.tags ?? []).filter(t => !SYSTEM_TAGS.has(t))
  const processed = stats.current

  return (
    <Overlay
      title="Unconfirmed"
      onClose={close}
      headerExtra={
        total > 0 && !finished ? (
          <div className="flex items-center gap-3">
            <div className="h-1 max-w-40 flex-1 overflow-hidden rounded-full bg-raised">
              <div className="h-full bg-accent transition-all" style={{ width: `${(index / total) * 100}%` }} />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-ink-faint">
              {index + 1}/{total}
            </span>
          </div>
        ) : null
      }
    >
      <div className="p-6">
        {loadFailed && <div className="text-center text-[13px] text-discard">Couldn’t load the review queue — is the server running?</div>}

        {queue === null && !loadFailed && <div className="text-center font-mono text-[12px] text-ink-faint">loading…</div>}

        {queue !== null && total === 0 && (
          <div className="py-6 text-center">
            <div className="font-display text-[18px] text-done">Nothing to review</div>
            <div className="mt-1 text-[12.5px] text-ink-muted">Every capture is confirmed. Nice.</div>
          </div>
        )}

        {finished && total > 0 && (
          <div className="py-4 text-center">
            <div className="font-display text-[20px] text-done">Queue cleared</div>
            <div className="mt-3 font-mono text-[12px] text-ink-muted">
              {total} items · ~{elapsedMin} min
            </div>
            <div className="mt-2 flex justify-center gap-4 font-mono text-[11.5px]">
              {processed.confirmed > 0 && <span className="text-done">{processed.confirmed} confirmed</span>}
              {processed.dismissed > 0 && <span className="text-discard">{processed.dismissed} dismissed</span>}
            </div>
            <button onClick={close} className="mt-5 rounded-md bg-accent px-4 py-1.5 text-[12.5px] text-bg">
              Close
            </button>
          </div>
        )}

        {item && (
          <>
            <div className="min-h-32">
              <div className="font-display text-[17px] leading-snug text-ink">{item.title ?? item.file}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[11px] text-ink-faint">
                {item.created && <span>{item.created}</span>}
                {item.bucket && <span className="text-ink-muted">{item.bucket}</span>}
                {item.due && <span className="text-waiting">due {item.due}</span>}
                {(item.related_people ?? []).length > 0 && <span>{item.related_people!.map(p => `@${p}`).join(' ')}</span>}
              </div>
              {item.body?.trim() && (
                <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-ink-muted">{item.body.trim()}</p>
              )}
              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {tags.map(t => (
                    <span key={t} className="rounded-full bg-raised px-2 py-0.5 text-[10.5px] text-ink-muted">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {ACTIONS.map(a => (
                <button
                  key={a.key}
                  onClick={() => act(a.key)}
                  disabled={busy}
                  className={`flex flex-col items-center gap-1 rounded-card border px-3 py-2.5 transition-colors disabled:opacity-50 ${a.className}`}
                >
                  <span className="text-[12.5px]">{a.label}</span>
                  <kbd className="font-mono text-[10px] text-ink-faint">{a.shortcut}</kbd>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Overlay>
  )
}

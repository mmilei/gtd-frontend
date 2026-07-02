import { useCallback, useEffect, useRef, useState } from 'react'
import { dismissItem, getBucket, moveItem } from '../lib/api'
import { SYSTEM_TAGS } from '../lib/types'
import type { Item } from '../lib/types'
import { Overlay } from './Overlay'

type TriageAction = 'today' | 'skip' | 'someday' | 'dismiss'

const ACTIONS: { key: TriageAction; label: string; shortcut: string; className: string }[] = [
  { key: 'today', label: 'Today', shortcut: '1', className: 'border-today/50 text-today hover:bg-today/10' },
  { key: 'skip', label: 'Skip', shortcut: '2', className: 'border-line text-ink-muted hover:bg-raised' },
  { key: 'someday', label: 'Someday', shortcut: '3', className: 'border-someday/50 text-someday hover:bg-someday/10' },
  { key: 'dismiss', label: 'Dismiss', shortcut: '4', className: 'border-discard/50 text-discard hover:bg-discard/10' },
]

interface Props {
  onClose: () => void
  onChanged: () => void
}

/** Morning triage as a ritual: one backlog item at a time, keyboard-first, summary at the end. */
export function TriageOverlay({ onClose, onChanged }: Props) {
  const [queue, setQueue] = useState<Item[] | null>(null)
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const stats = useRef({ today: 0, skipped: 0, someday: 0, dismissed: 0 })
  const startedAt = useRef(Date.now())

  useEffect(() => {
    getBucket('backlog')
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
    async (action: TriageAction) => {
      if (!item || busy) return
      setBusy(true)
      try {
        if (action === 'today') await moveItem(item.file, 'today')
        else if (action === 'someday') await moveItem(item.file, 'someday')
        else if (action === 'dismiss') await dismissItem(item.file)
        // skip = leave it in the backlog, just move on
        if (action === 'today') stats.current.today++
        else if (action === 'someday') stats.current.someday++
        else if (action === 'dismiss') stats.current.dismissed++
        else stats.current.skipped++
        setIndex(i => i + 1)
      } catch {
        // action failed — stay on the same item so nothing is silently skipped
      } finally {
        setBusy(false)
      }
    },
    [item, busy],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement | null)?.closest('input, textarea')) return
      const idx = ['1', '2', '3', '4'].indexOf(e.key)
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
      title="Triage"
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
        {loadFailed && <div className="text-center text-[13px] text-discard">Couldn’t load the backlog — is the server running?</div>}

        {queue === null && !loadFailed && <div className="text-center font-mono text-[12px] text-ink-faint">loading…</div>}

        {queue !== null && total === 0 && (
          <div className="py-6 text-center">
            <div className="font-display text-[18px] text-done">Backlog is empty</div>
            <div className="mt-1 text-[12.5px] text-ink-muted">Nothing to triage. Go live your day.</div>
          </div>
        )}

        {finished && total > 0 && (
          <div className="py-4 text-center">
            <div className="font-display text-[20px] text-done">Backlog cleared</div>
            <div className="mt-3 font-mono text-[12px] text-ink-muted">
              {total} items · ~{elapsedMin} min
            </div>
            <div className="mt-2 flex justify-center gap-4 font-mono text-[11.5px]">
              {processed.today > 0 && <span className="text-today">{processed.today} → today</span>}
              {processed.someday > 0 && <span className="text-someday">{processed.someday} → someday</span>}
              {processed.dismissed > 0 && <span className="text-discard">{processed.dismissed} dismissed</span>}
              {processed.skipped > 0 && <span className="text-ink-muted">{processed.skipped} skipped</span>}
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
                {item.due && <span className="text-waiting">due {item.due}</span>}
                {(item.delegado_a ?? []).length > 0 && <span>{item.delegado_a!.map(p => `@${p}`).join(' ')}</span>}
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

            <div className="mt-6 grid grid-cols-4 gap-2">
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

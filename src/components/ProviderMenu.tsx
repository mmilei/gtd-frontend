import { useEffect, useRef, useState } from 'react'
import { getProviders, selectProvider } from '../lib/api'
import type { ApiStatus } from '../state/useBuckets'
import type { ActionProviders, LlmAction, ProviderInfo } from '../lib/types'

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

/** User-facing labels for each pipeline step, in run order. */
const ACTION_LABEL: Record<LlmAction, string> = {
  TRIAGE: 'Triage',
  ENRICHMENT: 'Enrichment',
  RESOLVER: 'Resolver',
}

/** API status chip; click opens the per-action LLM provider settings panel. */
export function ProviderMenu({ apiStatus }: { apiStatus: ApiStatus }) {
  const [open, setOpen] = useState(false)
  const [actions, setActions] = useState<ActionProviders[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setActions(null)
    setError(null)
    getProviders()
      .then(({ actions }) => setActions(actions))
      .catch(() => setError('Could not load providers.'))

    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function pick(action: LlmAction, p: ProviderInfo) {
    const row = actions?.find(a => a.action === action)
    if (p.status !== 'UP' || !row || p.id === row.active) return
    try {
      await selectProvider(action, p.id)
      // Optimistic: flip only this action's active, leave the others as they were.
      setActions(prev => prev?.map(a => (a.action === action ? { ...a, active: p.id } : a)) ?? prev)
    } catch {
      setError(`Could not switch ${ACTION_LABEL[action]} to ${p.label}.`)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="LLM provider settings"
        className="flex items-center gap-2 rounded-md px-2 py-1 text-[12px] text-ink-muted transition-colors hover:bg-raised"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[apiStatus]}`} aria-hidden />
        {STATUS_LABEL[apiStatus]}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 w-72 animate-fade-up rounded-card border border-line bg-raised py-1 shadow-xl">
          <div className="px-3 pt-1.5 pb-1 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            Provider per action
          </div>
          {!actions && !error && <div className="px-3 py-2 font-mono text-[11px] text-ink-faint">loading…</div>}
          {actions?.map(row => (
            <div key={row.action} className="px-3 py-1.5">
              <div className="mb-1 text-[11px] font-medium text-ink-muted">{ACTION_LABEL[row.action]}</div>
              <div className="flex flex-wrap gap-1">
                {row.providers.map(p => {
                  const active = p.id === row.active
                  return (
                    <button
                      key={p.id}
                      onClick={() => pick(row.action, p)}
                      disabled={p.status !== 'UP'}
                      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] transition-colors disabled:opacity-40 ${
                        active
                          ? 'border-accent bg-surface text-ink'
                          : 'border-line text-ink-muted hover:bg-surface'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${p.status === 'UP' ? 'bg-done' : 'bg-discard'}`} />
                      <span>{p.label}</span>
                      {active && <span className="font-mono text-[9px] text-accent">active</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {error && <div className="px-3 py-2 text-[11.5px] text-discard">{error}</div>}
        </div>
      )}
    </div>
  )
}

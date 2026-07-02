import { useEffect, useRef, useState } from 'react'
import { getProviders, selectProvider } from '../lib/api'
import type { ApiStatus } from '../state/useBuckets'
import type { ProviderInfo } from '../lib/types'

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

/** API status chip; click opens the LLM provider switcher. */
export function ProviderMenu({ apiStatus }: { apiStatus: ApiStatus }) {
  const [open, setOpen] = useState(false)
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setProviders(null)
    setError(null)
    getProviders()
      .then(({ active, providers }) => {
        setActive(active)
        setProviders(providers)
      })
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

  async function pick(p: ProviderInfo) {
    if (p.status !== 'UP' || p.id === active) return
    try {
      await selectProvider(p.id)
      setActive(p.id)
      setOpen(false)
    } catch {
      setError(`Could not switch to ${p.label}.`)
    }
  }

  const activeLabel = providers?.find(p => p.id === active)?.label

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Switch LLM provider"
        className="flex items-center gap-2 rounded-md px-2 py-1 text-[12px] text-ink-muted transition-colors hover:bg-raised"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[apiStatus]}`} aria-hidden />
        {apiStatus === 'online' && activeLabel ? `${STATUS_LABEL.online} — ${activeLabel}` : STATUS_LABEL[apiStatus]}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 w-60 animate-fade-up rounded-card border border-line bg-raised py-1 shadow-xl">
          {!providers && !error && <div className="px-3 py-2 font-mono text-[11px] text-ink-faint">loading…</div>}
          {providers?.map(p => (
            <button
              key={p.id}
              onClick={() => pick(p)}
              disabled={p.status !== 'UP'}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-ink transition-colors hover:bg-surface disabled:opacity-40"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${p.status === 'UP' ? 'bg-done' : 'bg-discard'}`} />
              <span className="flex-1">{p.label}</span>
              {p.id === active && <span className="font-mono text-[10px] text-accent">active</span>}
            </button>
          ))}
          {error && <div className="px-3 py-2 text-[11.5px] text-discard">{error}</div>}
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Facet } from '../lib/types'

export type Route =
  /** The plain bucket list. */
  | { kind: 'list' }
  /**
   * A single card. The bucket segment of the URL is deliberately dropped: the card is resolved by
   * filename against the buckets currently loaded, so an old link still opens a task that has
   * since moved to another bucket.
   */
  | { kind: 'item'; file: string }
  | { kind: 'facet'; facet: Facet; value: string }
  /** The review queue for low-confidence captures. */
  | { kind: 'unconfirmed' }

/** Path for the unconfirmed review queue — parameterless, so a constant rather than a builder. */
export const UNCONFIRMED_PATH = '/unconfirmed'

/** URL vocabulary — the vault is written in Spanish, so the public paths are too. */
const FACET_SEGMENT: Record<Facet, string> = {
  tag: 'tag',
  project: 'proyecto',
  area: 'area',
  location: 'ubicacion',
  person: 'persona',
}

const FACET_SEGMENTS = Object.fromEntries(
  Object.entries(FACET_SEGMENT).map(([facet, segment]) => [segment, facet]),
) as Record<string, Facet>

/** Path for a cross-bucket facet view — the only place facet URLs are spelled out. */
export function facetPath(facet: Facet, value: string): string {
  return `/${FACET_SEGMENT[facet]}/${encodeURIComponent(value)}`
}

/** Path for a single card. The bucket segment is cosmetic — parseRoute resolves by filename. */
export function itemPath(bucket: string, file: string): string {
  return `/${encodeURIComponent(bucket)}/${encodeURIComponent(file)}`
}

/** Deploy prefix without its trailing slash: '' when served from the domain root. */
function basePrefix(): string {
  return (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
}

/** Turns an app path like `/backlog/x.md` into a browser URL under the deploy prefix. */
export function withBase(to: string): string {
  return `${basePrefix()}/${to.replace(/^\/+/, '')}`
}

/** A stray '%' (bad paste, hand-typed URL) throws in decodeURIComponent — fall back to the raw segment rather than crash the router. */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function parseRoute(pathname: string): Route {
  const prefix = basePrefix()
  const rel = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  const segments = rel.split('/').filter(Boolean).map(safeDecode)
  if (segments.length === 1 && segments[0] === UNCONFIRMED_PATH.slice(1)) return { kind: 'unconfirmed' }
  if (segments.length === 2) {
    const [first, second] = segments
    if (second.endsWith('.md')) return { kind: 'item', file: second }
    const facet = FACET_SEGMENTS[first]
    if (facet) return { kind: 'facet', facet, value: second }
  }
  return { kind: 'list' }
}

export interface RouteState {
  route: Route
  /** True when this entry was pushed from inside the app — render a modal over the list, not a page. */
  modal: boolean
  navigate: (to: string, options?: { modal?: boolean }) => void
  /** Leaves the current entry — how a modal opened by `navigate` is closed. */
  back: () => void
  /**
   * Registers a handler that intercepts the next browser back/forward instead of letting it apply —
   * a dirty EditModal uses this to show its own discard-confirmation instead of being silently
   * unmounted by the route change. Pass null to clear (modal becomes clean, or unmounts).
   */
  setBackGuard: (handler: (() => void) | null) => void
  /** Read-only check for other popstate listeners (App's navVersion/refresh bump) to skip their own
   *  work on a popstate that a guard just absorbed — see setBackGuard. */
  isBackGuarded: () => boolean
}

function readLocation(): { route: Route; modal: boolean } {
  return {
    route: parseRoute(window.location.pathname),
    modal: (window.history.state as { modal?: boolean } | null)?.modal === true,
  }
}

export function useRoute(): RouteState {
  // A reload restores history.state, so the first render deliberately ignores the stored modal
  // flag: only in-app navigation (or traversing back to such an entry) renders a modal.
  const [state, setState] = useState(() => ({ route: parseRoute(window.location.pathname), modal: false }))
  const backGuardRef = useRef<(() => void) | null>(null)
  // Shadow of the history entry `state` is currently rendering — a popstate has already applied by
  // the time the event fires (there is no way to cancel it), so a blocked back-navigation is undone
  // by pushing this remembered entry back on top rather than by trying to stop the browser.
  const currentEntryRef = useRef<{ url: string; navState: unknown }>({
    url: window.location.href,
    navState: window.history.state,
  })

  useEffect(() => {
    const onPopState = () => {
      const guard = backGuardRef.current
      if (guard) {
        const entry = currentEntryRef.current
        window.history.pushState(entry.navState, '', entry.url)
        guard()
        return
      }
      currentEntryRef.current = { url: window.location.href, navState: window.history.state }
      setState(readLocation())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: string, options?: { modal?: boolean }) => {
    const modal = options?.modal === true
    window.history.pushState({ modal }, '', withBase(to))
    currentEntryRef.current = { url: window.location.href, navState: window.history.state }
    setState(readLocation())
  }, [])

  const back = useCallback(() => window.history.back(), [])
  const setBackGuard = useCallback((handler: (() => void) | null) => {
    backGuardRef.current = handler
  }, [])
  const isBackGuarded = useCallback(() => backGuardRef.current !== null, [])

  return { ...state, navigate, back, setBackGuard, isBackGuarded }
}

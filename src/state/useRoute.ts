import { useCallback, useEffect, useState } from 'react'
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

export function parseRoute(pathname: string): Route {
  const prefix = basePrefix()
  const rel = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  const segments = rel.split('/').filter(Boolean).map(decodeURIComponent)
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

  useEffect(() => {
    const onPopState = () => setState(readLocation())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: string, options?: { modal?: boolean }) => {
    const modal = options?.modal === true
    window.history.pushState({ modal }, '', withBase(to))
    setState(readLocation())
  }, [])

  const back = useCallback(() => window.history.back(), [])

  return { ...state, navigate, back }
}

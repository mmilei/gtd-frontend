import { useCallback, useEffect, useState } from 'react'

/**
 * Cross-bucket view dimensions reachable by URL. Values match the app-side facet names;
 * `person` is not a `Facet` yet, so this stays a standalone union.
 */
export type RouteFacet = 'tag' | 'project' | 'area' | 'person'

export type Route =
  /** The plain bucket list. */
  | { kind: 'list' }
  /**
   * A single card. The bucket segment of the URL is deliberately dropped: the card is resolved by
   * filename against the buckets currently loaded, so an old link still opens a task that has
   * since moved to another bucket.
   */
  | { kind: 'item'; file: string }
  | { kind: 'facet'; facet: RouteFacet; value: string }

/** URL vocabulary — the vault is written in Spanish, so the public paths are too. */
const FACET_SEGMENTS: Record<string, RouteFacet> = {
  tag: 'tag',
  proyecto: 'project',
  area: 'area',
  persona: 'person',
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
}

function readLocation(): { route: Route; modal: boolean } {
  return {
    route: parseRoute(window.location.pathname),
    modal: (window.history.state as { modal?: boolean } | null)?.modal === true,
  }
}

export function useRoute(): RouteState {
  const [state, setState] = useState(readLocation)

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

  return { ...state, navigate }
}

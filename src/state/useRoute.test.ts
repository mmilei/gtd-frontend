import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseRoute, useRoute, withBase } from './useRoute'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('parseRoute', () => {
  it('parses the root as the bucket list', () => {
    expect(parseRoute('/')).toEqual({ kind: 'list' })
    expect(parseRoute('')).toEqual({ kind: 'list' })
  })

  it('parses a card path', () => {
    expect(parseRoute('/backlog/20260824-101500-buy-screws.md')).toEqual({
      kind: 'item',
      file: '20260824-101500-buy-screws.md',
    })
  })

  it('resolves a card by filename, ignoring the bucket segment', () => {
    const file = '20260824-101500-buy-screws.md'
    expect(parseRoute(`/today/${file}`)).toEqual(parseRoute(`/someday/${file}`))
  })

  it('parses every facet path', () => {
    expect(parseRoute('/tag/home')).toEqual({ kind: 'facet', facet: 'tag', value: 'home' })
    expect(parseRoute('/proyecto/gtd-frontend')).toEqual({ kind: 'facet', facet: 'project', value: 'gtd-frontend' })
    expect(parseRoute('/area/work')).toEqual({ kind: 'facet', facet: 'area', value: 'work' })
    expect(parseRoute('/persona/Alex')).toEqual({ kind: 'facet', facet: 'person', value: 'Alex' })
  })

  it('parses the unconfirmed review queue', () => {
    expect(parseRoute('/unconfirmed')).toEqual({ kind: 'unconfirmed' })
  })

  it('decodes percent-encoded facet values', () => {
    expect(parseRoute('/tag/hardware%20store')).toEqual({ kind: 'facet', facet: 'tag', value: 'hardware store' })
  })

  it('falls back to the list for unknown shapes', () => {
    expect(parseRoute('/nonsense/value')).toEqual({ kind: 'list' })
    expect(parseRoute('/tag')).toEqual({ kind: 'list' })
  })

  it('does not throw on a malformed percent-encoding — a stray "%" is kept as-is', () => {
    expect(() => parseRoute('/tag/100%')).not.toThrow()
    expect(parseRoute('/tag/100%')).toEqual({ kind: 'facet', facet: 'tag', value: '100%' })
  })

  it('strips the deploy prefix from BASE_URL', () => {
    vi.stubEnv('BASE_URL', '/gtd-frontend/')
    expect(parseRoute('/gtd-frontend/')).toEqual({ kind: 'list' })
    expect(parseRoute('/gtd-frontend/backlog/x.md')).toEqual({ kind: 'item', file: 'x.md' })
    expect(withBase('/tag/home')).toBe('/gtd-frontend/tag/home')
  })
})

describe('useRoute navigate', () => {
  it('pushes the target path and the modal flag, then exposes the new route', () => {
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(() => useRoute())

    act(() => result.current.navigate('/backlog/x.md', { modal: true }))

    expect(pushState).toHaveBeenCalledWith({ modal: true }, '', '/backlog/x.md')
    expect(result.current.route).toEqual({ kind: 'item', file: 'x.md' })
    expect(result.current.modal).toBe(true)
  })

  it('defaults the modal flag to false', () => {
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(() => useRoute())

    act(() => result.current.navigate('/tag/home'))

    expect(pushState).toHaveBeenCalledWith({ modal: false }, '', '/tag/home')
    expect(result.current.route).toEqual({ kind: 'facet', facet: 'tag', value: 'home' })
    expect(result.current.modal).toBe(false)
  })

  it('applies the deploy prefix to the pushed URL', () => {
    vi.stubEnv('BASE_URL', '/gtd-frontend/')
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(() => useRoute())

    act(() => result.current.navigate('/persona/Alex'))

    expect(pushState).toHaveBeenCalledWith({ modal: false }, '', '/gtd-frontend/persona/Alex')
  })
})

describe('useRoute popstate', () => {
  it('updates the exposed route when the browser goes back', () => {
    const { result } = renderHook(() => useRoute())

    act(() => result.current.navigate('/backlog/x.md', { modal: true }))
    expect(result.current.route).toEqual({ kind: 'item', file: 'x.md' })

    act(() => {
      window.history.replaceState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })

    expect(result.current.route).toEqual({ kind: 'list' })
    expect(result.current.modal).toBe(false)
  })
})

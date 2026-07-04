import { useCallback, useEffect, useRef, useState } from 'react'
import { dismissItem, getBuckets, getToday, markDone } from '../lib/api'
import type { Bucket, BucketsMap, Item } from '../lib/types'

const EMPTY: BucketsMap = { today: [], backlog: [], waiting: [], someday: [], reference: [] }

const FALLBACK_EXIT_ANIMATION_MS = 280

/**
 * Reads --duration-card-out (app.css) instead of hardcoding a matching literal here — the two
 * can't silently drift apart. Falls back if the custom property is ever missing/unparsable.
 */
function exitAnimationMs(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--duration-card-out').trim()
  const ms = raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000
  return Number.isFinite(ms) ? ms : FALLBACK_EXIT_ANIMATION_MS
}

export type ApiStatus = 'connecting' | 'online' | 'offline'

export interface BucketsState {
  buckets: BucketsMap
  apiStatus: ApiStatus
  refresh: () => Promise<void>
  completeItem: (item: Item) => Promise<boolean>
  removeItem: (item: Item) => Promise<boolean>
}

export function useBuckets(): BucketsState {
  const [buckets, setBuckets] = useState<BucketsMap>(EMPTY)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('connecting')
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // /today applies backend-side ordering, so it overrides the today list from /buckets.
  const refresh = useCallback(async () => {
    try {
      const [all, today] = await Promise.all([getBuckets(), getToday()])
      if (!alive.current) return
      setBuckets({ ...EMPTY, ...all, today })
      setApiStatus('online')
    } catch {
      if (alive.current) setApiStatus('offline')
    }
  }, [])

  // refresh doubles as the health check: it flips apiStatus on every outcome.
  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), 30_000)
    return () => clearInterval(id)
  }, [refresh])

  /** Run the API action, let the exit animation finish, then drop the item locally and re-sync. */
  const withOptimisticRemove = useCallback(
    async (item: Item, action: () => Promise<unknown>): Promise<boolean> => {
      try {
        await Promise.all([action(), new Promise(r => setTimeout(r, exitAnimationMs()))])
        if (!alive.current) return true
        setBuckets(prev => {
          const next = { ...prev }
          for (const b of Object.keys(next) as Bucket[]) {
            next[b] = next[b].filter(i => i.file !== item.file)
          }
          return next
        })
        void refresh()
        return true
      } catch {
        return false
      }
    },
    [refresh],
  )

  const completeItem = useCallback(
    (item: Item) => withOptimisticRemove(item, () => markDone(item.file)),
    [withOptimisticRemove],
  )
  const removeItem = useCallback(
    (item: Item) => withOptimisticRemove(item, () => dismissItem(item.file)),
    [withOptimisticRemove],
  )

  return { buckets, apiStatus, refresh, completeItem, removeItem }
}

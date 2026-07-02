import { useCallback, useEffect, useRef, useState } from 'react'
import { dismissItem, getBuckets, getToday, markDone, moveItem } from '../lib/api'
import type { Bucket, BucketsMap, Item } from '../lib/types'

const EMPTY: BucketsMap = { today: [], backlog: [], waiting: [], someday: [], reference: [] }

/** Matches --animate-card-out in app.css so items finish leaving before the state drops them. */
const EXIT_ANIMATION_MS = 280

export type ApiStatus = 'connecting' | 'online' | 'offline'

export interface BucketsState {
  buckets: BucketsMap
  apiStatus: ApiStatus
  refresh: () => Promise<void>
  completeItem: (item: Item) => Promise<boolean>
  removeItem: (item: Item) => Promise<boolean>
  sendToToday: (item: Item) => Promise<boolean>
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
        await Promise.all([action(), new Promise(r => setTimeout(r, EXIT_ANIMATION_MS))])
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
  const sendToToday = useCallback(
    (item: Item) => withOptimisticRemove(item, () => moveItem(item.file, 'today')),
    [withOptimisticRemove],
  )

  return { buckets, apiStatus, refresh, completeItem, removeItem, sendToToday }
}

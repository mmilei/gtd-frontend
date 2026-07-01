import { useCallback, useEffect, useRef, useState } from 'react'
import { dismissItem, getBuckets, getToday, markDone, moveItem, ping } from '../lib/api'
import type { Bucket, BucketsMap, Item } from '../lib/types'

const EMPTY: BucketsMap = { today: [], backlog: [], waiting: [], someday: [], reference: [] }

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

  useEffect(() => {
    let cancelled = false
    async function healthCheck() {
      const ok = await ping()
      if (cancelled) return
      if (ok) {
        await refresh()
      } else {
        setApiStatus('offline')
      }
    }
    healthCheck()
    const id = setInterval(healthCheck, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [refresh])

  /** Optimistically drop the item locally, then re-sync in the background. */
  const withOptimisticRemove = useCallback(
    async (item: Item, action: () => Promise<unknown>): Promise<boolean> => {
      try {
        await action()
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

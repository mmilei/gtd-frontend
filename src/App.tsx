import { useMemo, useState } from 'react'
import { BucketRail } from './components/BucketRail'
import { Header } from './components/Header'
import { ItemList } from './components/ItemList'
import type { Bucket } from './lib/types'
import { useBuckets } from './state/useBuckets'

const IS_MOCK = import.meta.env.VITE_MOCK === 'true'

export default function App() {
  const { buckets, apiStatus, completeItem, removeItem, sendToToday } = useBuckets()
  const [bucket, setBucket] = useState<Bucket>('today')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  function selectBucket(next: Bucket) {
    setBucket(next)
    setSelectedTags(new Set())
  }

  function toggleTag(tag: string, additive: boolean) {
    setSelectedTags(prev => {
      if (additive) {
        const next = new Set(prev)
        next.has(tag) ? next.delete(tag) : next.add(tag)
        return next
      }
      return prev.size === 1 && prev.has(tag) ? new Set() : new Set([tag])
    })
  }

  const bucketItems = buckets[bucket] ?? []
  const visibleItems = useMemo(
    () =>
      selectedTags.size === 0
        ? bucketItems
        : bucketItems.filter(i => [...selectedTags].every(t => (i.tags ?? []).includes(t))),
    [bucketItems, selectedTags],
  )

  return (
    <div className="flex h-full flex-col">
      {IS_MOCK && (
        <div className="shrink-0 bg-accent-soft px-5 py-1 text-center text-[11px] text-accent">
          Demo mode — data is fictional and resets on reload
        </div>
      )}
      <Header apiStatus={apiStatus} />
      <div className="flex min-h-0 flex-1">
        <BucketRail buckets={buckets} active={bucket} onSelect={selectBucket} />
        <main className="flex min-w-0 flex-1 flex-col">
          <ItemList
            bucket={bucket}
            items={visibleItems}
            allItems={bucketItems}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            onComplete={completeItem}
            onDismiss={removeItem}
            onSendToToday={sendToToday}
          />
        </main>
      </div>
    </div>
  )
}

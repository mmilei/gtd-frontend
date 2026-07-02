import { useCallback, useMemo, useState } from 'react'
import { BucketRail } from './components/BucketRail'
import { CaptureBar } from './components/CaptureBar'
import { EditModal } from './components/EditModal'
import { Header } from './components/Header'
import { ItemList } from './components/ItemList'
import { OpsFeed } from './components/OpsFeed'
import type { FeedEntry } from './components/OpsFeed'
import { ReviewOverlay } from './components/ReviewOverlay'
import { TriageOverlay } from './components/TriageOverlay'
import { UndoToast, useUndoToast } from './components/UndoToast'
import { AmbientScene } from './components/AmbientScene'
import { FocusOverlay } from './components/FocusOverlay'
import { chat, dismissItem, replaceBody } from './lib/api'
import { celebrate } from './lib/celebration'
import { orderToday } from './lib/todayOrder'
import { SYSTEM_TAGS } from './lib/types'
import type { Bucket, Item, Op } from './lib/types'
import { useBuckets } from './state/useBuckets'

const IS_MOCK = import.meta.env.VITE_MOCK === 'true'

let feedId = 0
const timeNow = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export default function App() {
  const { buckets, apiStatus, refresh, completeItem, removeItem } = useBuckets()
  const [bucket, setBucket] = useState<Bucket>('today')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [feed, setFeed] = useState<FeedEntry[]>([])
  const [capturing, setCapturing] = useState(false)
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [triageOpen, setTriageOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [focusSession, setFocusSession] = useState<{ queue: Item[]; startIndex: number } | null>(null)

  const { toast, show: showUndo, dismiss: dismissToast, runUndo } = useUndoToast(refresh)

  function selectBucket(next: Bucket) {
    setBucket(next)
    setSelectedTags(new Set())
  }

  function toggleTag(tag: string, additive: boolean) {
    setSelectedTags(prev => {
      if (additive) {
        const next = new Set(prev)
        if (next.has(tag)) next.delete(tag)
        else next.add(tag)
        return next
      }
      return prev.size === 1 && prev.has(tag) ? new Set() : new Set([tag])
    })
  }

  const bucketItems = buckets[bucket] ?? []
  const visibleItems = useMemo(() => {
    const filtered =
      selectedTags.size === 0
        ? bucketItems
        : bucketItems.filter(i => [...selectedTags].every(t => (i.tags ?? []).includes(t)))
    return bucket === 'today' ? orderToday(filtered) : filtered
  }, [bucket, bucketItems, selectedTags])

  const startFocus = useCallback(
    (item?: Item) => {
      const queue = orderToday(buckets.today ?? [])
      if (queue.length === 0) return
      const startIndex = item ? Math.max(0, queue.findIndex(i => i.file === item.file)) : 0
      setFocusSession({ queue, startIndex })
    },
    [buckets.today],
  )

  const tagSuggestions = useMemo(() => {
    const all = new Set<string>()
    for (const items of Object.values(buckets)) {
      for (const item of items) {
        for (const t of item.tags ?? []) if (!SYSTEM_TAGS.has(t)) all.add(t)
      }
    }
    return [...all].sort()
  }, [buckets])

  // ── Capture ────────────────────────────────────────────────
  const sendCapture = useCallback(
    async (text: string) => {
      const id = ++feedId
      setFeed(prev => [...prev, { id, text, time: timeNow(), status: 'pending' }])
      setCapturing(true)
      try {
        const { fallback, ops } = await chat(text)
        setFeed(prev => prev.map(e => (e.id === id ? { ...e, status: 'done', fallback, ops } : e)))
        void refresh()
      } catch (err) {
        setFeed(prev =>
          prev.map(e =>
            e.id === id ? { ...e, status: 'error', error: err instanceof Error ? err.message : String(err) } : e,
          ),
        )
      } finally {
        setCapturing(false)
      }
    },
    [refresh],
  )

  const captureError = useCallback((message: string) => {
    setFeed(prev => [...prev, { id: ++feedId, text: '(voice)', time: timeNow(), status: 'error', error: message }])
  }, [])

  function resolveOp(entryId: number, opIndex: number, outcome: string) {
    setFeed(prev =>
      prev.map(e => (e.id === entryId ? { ...e, resolved: { ...e.resolved, [opIndex]: outcome } } : e)),
    )
  }

  async function confirmOp(entryId: number, opIndex: number, op: Op) {
    const target = op.target_file
    if (!target) return
    try {
      if (op.op === 'dismiss') {
        await dismissItem(target)
        resolveOp(entryId, opIndex, `Dismissed — ${op.title ?? target}`)
      } else {
        await replaceBody(target, op.proposed_body ?? '')
        resolveOp(entryId, opIndex, `Applied — ${op.title ?? target}`)
      }
      void refresh()
    } catch {
      // card stays actionable for a retry
    }
  }

  // ── Item actions with undo ─────────────────────────────────
  const withUndo = useCallback(
    (action: (item: Item) => Promise<boolean>, verb: string) =>
      async (item: Item) => {
        const ok = await action(item)
        if (ok) showUndo(`${verb} — ${item.title ?? item.file}`)
        return ok
      },
    [showUndo],
  )

  const complete = useMemo(() => {
    const withToast = withUndo(completeItem, 'Done')
    return async (item: Item) => {
      const ok = await withToast(item)
      if (ok) celebrate()
      return ok
    }
  }, [withUndo, completeItem])
  const remove = useMemo(() => withUndo(removeItem, 'Dismissed'), [withUndo, removeItem])

  return (
    <>
    <AmbientScene />
    <div className="relative z-10 flex h-full flex-col">
      {IS_MOCK && (
        <div className="shrink-0 bg-accent-soft px-5 py-1 text-center text-[11px] text-accent">
          Demo mode — data is fictional and resets on reload
        </div>
      )}
      <Header apiStatus={apiStatus} onOpenTriage={() => setTriageOpen(true)} onOpenReview={() => setReviewOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <BucketRail buckets={buckets} active={bucket} onSelect={selectBucket} />
        <main className="flex min-w-0 flex-1 flex-col">
          <ItemList
            bucket={bucket}
            items={visibleItems}
            allItems={bucketItems}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            onOpenItem={setEditingFile}
            onComplete={complete}
            onDismiss={remove}
            onFocus={bucket === 'today' ? startFocus : undefined}
          />
          <OpsFeed entries={feed} onOpenItem={setEditingFile} onConfirmOp={confirmOp} onCancelOp={(id, i) => resolveOp(id, i, 'Cancelled — no changes')} />
          <CaptureBar busy={capturing} onSend={sendCapture} onError={captureError} />
        </main>
      </div>

      {editingFile && (
        <EditModal
          file={editingFile}
          tagSuggestions={tagSuggestions}
          onClose={() => setEditingFile(null)}
          onSaved={() => void refresh()}
        />
      )}
      {triageOpen && <TriageOverlay onClose={() => setTriageOpen(false)} onChanged={() => void refresh()} />}
      {reviewOpen && <ReviewOverlay onClose={() => setReviewOpen(false)} onChanged={() => void refresh()} />}
      {focusSession && (
        <FocusOverlay
          queue={focusSession.queue}
          startIndex={focusSession.startIndex}
          onClose={() => setFocusSession(null)}
          onChanged={() => void refresh()}
        />
      )}

      <UndoToast toast={toast} onUndo={runUndo} onDismiss={dismissToast} />
    </div>
    </>
  )
}

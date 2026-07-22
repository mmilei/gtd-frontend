import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AreaBar } from './components/AreaBar'
import { BucketRail } from './components/BucketRail'
import { CaptureBar } from './components/CaptureBar'
import { EditModal } from './components/EditModal'
import { Header } from './components/Header'
import { HistoryPanel } from './components/HistoryPanel'
import { ItemList } from './components/ItemList'
import { OpsFeed } from './components/OpsFeed'
import type { FeedEntry } from './components/OpsFeed'
import { FacetView } from './components/FacetView'
import { ReviewOverlay } from './components/ReviewOverlay'
import { SearchOverlay } from './components/SearchOverlay'
import { TriageOverlay } from './components/TriageOverlay'
import { UnconfirmedQueue } from './components/UnconfirmedQueue'
import { UndoToast, useUndoToast } from './components/UndoToast'
import { AmbientScene } from './components/AmbientScene'
import { FocusOverlay } from './components/FocusOverlay'
import { chat, confirmChatOp, getAreas, getChatHistory } from './lib/api'
import { celebrate } from './lib/celebration'
import { orderByPriority, orderToday } from './lib/todayOrder'
import { SYSTEM_TAGS } from './lib/types'
import type { Bucket, ChatHistoryEntry, Facet, Item, Op } from './lib/types'
import { useBuckets } from './state/useBuckets'

const IS_MOCK = import.meta.env.VITE_MOCK === 'true'

let localFeedId = 0
const nextLocalId = () => `local-${++localFeedId}`
const formatTime = (iso?: string) =>
  new Date(iso ?? Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/** Pairs up consecutive user/assistant transcript entries into the same shape a live capture produces. */
function hydrateFeed(history: ChatHistoryEntry[]): FeedEntry[] {
  const entries: FeedEntry[] = []
  for (let i = 0; i < history.length; i++) {
    const h = history[i]
    if (h.role !== 'user') continue
    const next = history[i + 1]
    const assistant = next?.role === 'assistant' ? next : undefined
    const resolved: Record<number, string> = {}
    assistant?.ops?.forEach((op, idx) => {
      if (op.requires_confirmation && op.resolved) resolved[idx] = 'Resolved'
    })
    entries.push({
      id: h.id,
      text: h.text ?? '',
      time: formatTime(h.ts),
      status: assistant ? 'done' : 'pending',
      fallback: assistant?.fallback,
      ops: assistant?.ops,
      resolved,
    })
    if (assistant) i++
  }
  return entries
}

export default function App() {
  const { buckets, apiStatus, refresh, completeItem, removeItem } = useBuckets()
  const [bucket, setBucket] = useState<Bucket>('today')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [feed, setFeed] = useState<FeedEntry[]>([])
  const [capturing, setCapturing] = useState(false)
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [facetView, setFacetView] = useState<{ facet: Facet; value: string } | null>(null)
  // Remembers the facet view an item was opened from, so closing EditModal can return to it
  // instead of dropping the user back to the plain bucket list.
  const returnToFacetRef = useRef<{ facet: Facet; value: string } | null>(null)
  const [triageOpen, setTriageOpen] = useState(false)
  const [unconfirmedOpen, setUnconfirmedOpen] = useState(false)
  // Set when EditModal was opened from the Unconfirmed queue, so closing the editor returns there.
  const returnToUnconfirmedRef = useRef(false)
  // The area vocabulary lives in backend config (gtd.areas) — fetched once, empty while loading.
  const [areaOptions, setAreaOptions] = useState<string[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [focusSession, setFocusSession] = useState<{ queue: Item[]; startIndex: number } | null>(null)

  const { toast, show: showUndo, dismiss: dismissToast, runUndo } = useUndoToast(refresh)

  // Rehydrate this session's feed from the durable transcript so a reload doesn't lose
  // still-pending requires_confirmation cards (or the fact that earlier captures happened).
  useEffect(() => {
    getChatHistory()
      .then(history => setFeed(hydrateFeed(history)))
      .catch(() => {
        // no transcript yet (fresh vault) or backend unavailable — starting empty is fine
      })
  }, [])

  useEffect(() => {
    getAreas()
      .then(setAreaOptions)
      .catch(() => {
        // backend unavailable — AreaBar stays hidden and the area select offers only the current value
      })
  }, [])

  // Ctrl/Cmd+K toggles the global search overlay (Overlay itself handles Escape-to-close).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
    return bucket === 'today' ? orderToday(filtered) : orderByPriority(filtered)
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

  // Low-confidence captures live in their normal buckets, just flagged confirmed:false — count them
  // straight off the loaded buckets so the Header badge stays in sync with every refresh.
  const unconfirmedCount = useMemo(
    () => Object.values(buckets).reduce((n, items) => n + items.filter(i => i.confirmed === false).length, 0),
    [buckets],
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

  // Distinct non-blank project values across all buckets — same client-side aggregation as tags.
  const projectSuggestions = useMemo(() => {
    const all = new Set<string>()
    for (const items of Object.values(buckets)) {
      for (const item of items) {
        const p = item.project?.trim()
        if (p) all.add(p)
      }
    }
    return [...all].sort()
  }, [buckets])

  // Distinct non-blank location values across all buckets — same client-side aggregation as projects.
  const locationSuggestions = useMemo(() => {
    const all = new Set<string>()
    for (const items of Object.values(buckets)) {
      for (const item of items) {
        const l = item.location?.trim()
        if (l) all.add(l)
      }
    }
    return [...all].sort()
  }, [buckets])

  // ── Capture ────────────────────────────────────────────────
  const sendCapture = useCallback(
    async (text: string) => {
      const id = nextLocalId()
      setFeed(prev => [...prev, { id, text, time: formatTime(), status: 'pending' }])
      setCapturing(true)
      try {
        const { fallback, ops } = await chat(text)
        setFeed(prev => prev.map(e => (e.id === id ? { ...e, status: 'done', fallback, ops } : e)))
        const undoable = ops.filter(o => o.filed && (o.op === 'move' || o.op === 'done'))
        if (undoable.length > 0) {
          const last = undoable[undoable.length - 1]
          showUndo(`${last.op === 'move' ? 'Moved' : 'Done'} — ${last.title ?? last.file ?? ''}`)
        }
        // Low classifier confidence (confirmed: false) opens the same editor a manual edit uses —
        // saving there (even with no changes) is itself the confirmation.
        const needsReview = ops.find(o => o.op === 'create' && o.confirmed === false && o.file)
        if (needsReview?.file) setEditingFile(needsReview.file)
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
    [refresh, showUndo, setEditingFile],
  )

  const captureError = useCallback((message: string) => {
    setFeed(prev => [...prev, { id: nextLocalId(), text: '(voice)', time: formatTime(), status: 'error', error: message }])
  }, [])

  function resolveOp(entryId: string, opIndex: number, outcome: string) {
    setFeed(prev =>
      prev.map(e => (e.id === entryId ? { ...e, resolved: { ...e.resolved, [opIndex]: outcome } } : e)),
    )
  }

  async function confirmOp(entryId: string, opIndex: number, op: Op) {
    const target = op.target_file
    if (!target || !op.op) return
    try {
      await confirmChatOp({ target_file: target, op: op.op, proposed_body: op.proposed_body, chat_ref: op.chat_ref })
      const label = op.op === 'dismiss' ? 'Dismissed' : 'Applied'
      resolveOp(entryId, opIndex, `${label} — ${op.title ?? target}`)
      showUndo(`${label} — ${op.title ?? target}`)
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
      <Header
        apiStatus={apiStatus}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenTriage={() => setTriageOpen(true)}
        onOpenReview={() => setReviewOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenUnconfirmed={() => setUnconfirmedOpen(true)}
        unconfirmedCount={unconfirmedCount}
      />
      <div className="flex min-h-0 flex-1">
        <BucketRail
          buckets={buckets}
          active={bucket}
          onSelect={selectBucket}
          projects={projectSuggestions}
          onOpenProject={value => setFacetView({ facet: 'project', value })}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <AreaBar areas={areaOptions} onOpenArea={value => setFacetView({ facet: 'area', value })} />
          <ItemList
            bucket={bucket}
            items={visibleItems}
            allItems={bucketItems}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            onViewTagAcross={value => setFacetView({ facet: 'tag', value })}
            onOpenItem={setEditingFile}
            onOpenProject={value => setFacetView({ facet: 'project', value })}
            onOpenLocation={value => setFacetView({ facet: 'location', value })}
            onComplete={complete}
            onDismiss={remove}
            onFocus={bucket === 'today' ? startFocus : undefined}
          />
          <OpsFeed
            entries={feed}
            onOpenItem={setEditingFile}
            onConfirmOp={confirmOp}
            onCancelOp={(id, i) => resolveOp(id, i, 'Cancelled — no changes')}
          />
          <CaptureBar busy={capturing} onSend={sendCapture} onError={captureError} />
        </main>
      </div>

      {editingFile && (
        <EditModal
          file={editingFile}
          tagSuggestions={tagSuggestions}
          projectSuggestions={projectSuggestions}
          locationSuggestions={locationSuggestions}
          areaOptions={areaOptions}
          onClose={() => {
            setEditingFile(null)
            if (returnToFacetRef.current) {
              setFacetView(returnToFacetRef.current)
              returnToFacetRef.current = null
            }
            if (returnToUnconfirmedRef.current) {
              setUnconfirmedOpen(true)
              returnToUnconfirmedRef.current = false
            }
          }}
          onSaved={() => void refresh()}
        />
      )}
      {searchOpen && (
        <SearchOverlay buckets={buckets} onOpenItem={setEditingFile} onClose={() => setSearchOpen(false)} />
      )}
      {facetView && (
        <FacetView
          facet={facetView.facet}
          value={facetView.value}
          buckets={buckets}
          onOpenItem={file => {
            returnToFacetRef.current = facetView
            setFacetView(null)
            setEditingFile(file)
          }}
          onOpenProject={value => setFacetView({ facet: 'project', value })}
          onOpenLocation={value => setFacetView({ facet: 'location', value })}
          onComplete={complete}
          onDismiss={remove}
          onClose={() => setFacetView(null)}
        />
      )}
      {triageOpen && <TriageOverlay onClose={() => setTriageOpen(false)} onChanged={() => void refresh()} />}
      {unconfirmedOpen && (
        <UnconfirmedQueue
          onClose={() => setUnconfirmedOpen(false)}
          onChanged={() => void refresh()}
          onEdit={file => {
            returnToUnconfirmedRef.current = true
            setUnconfirmedOpen(false)
            setEditingFile(file)
          }}
        />
      )}
      {reviewOpen && <ReviewOverlay onClose={() => setReviewOpen(false)} onChanged={() => void refresh()} />}
      {historyOpen && <HistoryPanel onClose={() => setHistoryOpen(false)} />}
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

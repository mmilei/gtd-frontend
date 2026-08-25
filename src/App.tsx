import { useCallback, useEffect, useMemo, useState } from 'react'
import { AreaBar } from './components/AreaBar'
import { BucketRail } from './components/BucketRail'
import { CaptureBar } from './components/CaptureBar'
import { CardPage, pageFrame } from './components/CardPage'
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
import { UNCONFIRMED_PATH, facetPath, itemPath, useRoute } from './state/useRoute'

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
  const { route, modal, navigate, back } = useRoute()
  const [bucket, setBucket] = useState<Bucket>('today')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [feed, setFeed] = useState<FeedEntry[]>([])
  const [capturing, setCapturing] = useState(false)
  // The open card and the open facet view are the URL, not state: closing one is history.back(),
  // which is also what restores whatever view it was opened from.
  // Entered by URL rather than from inside the app: the card/facet is the page, so the list is
  // never mounted behind it — same chrome (header + rail), different main.
  const pageMode = route.kind !== 'list' && !modal
  const editingFile = route.kind === 'item' ? route.file : null
  const facetView = route.kind === 'facet' ? { facet: route.facet, value: route.value } : null
  // Opens EditModal in "new task" mode (file=null) instead of loading an existing one.
  const [creatingNew, setCreatingNew] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [triageOpen, setTriageOpen] = useState(false)
  // The area vocabulary lives in backend config (gtd.areas) — fetched once, empty while loading.
  const [areaOptions, setAreaOptions] = useState<string[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [focusSession, setFocusSession] = useState<{ queue: Item[]; startIndex: number } | null>(null)
  // Bumped on every popstate and on a bfcache restore (pageshow, event.persisted) — remounts the
  // open item editor below via `key`, forcing a fresh fetch instead of showing whatever it last had.
  const [navVersion, setNavVersion] = useState(0)

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

  // URL back/forward never trusts what's already in memory: re-pull buckets and force the open
  // item editor to refetch. A bfcache restore (pageshow with persisted:true) gets the same
  // treatment — the whole page came back frozen from before, data and all.
  useEffect(() => {
    const onPopState = () => {
      setNavVersion(v => v + 1)
      void refresh()
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      setNavVersion(v => v + 1)
      void refresh()
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [refresh])

  function selectBucket(next: Bucket) {
    setBucket(next)
    setSelectedTags(new Set())
    // The rail stays live on a standalone page — picking a bucket means "show me that list".
    if (pageMode) navigate('/')
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

  // In-app navigation always pushes modal: true — the same URL entered directly renders as a page.
  const openItem = useCallback(
    (file: string) => {
      const owner = (Object.keys(buckets) as Bucket[]).find(b => buckets[b].some(i => i.file === file))
      navigate(itemPath(owner ?? bucket, file), { modal: true })
    },
    [buckets, bucket, navigate],
  )
  const openFacet = useCallback(
    (facet: Facet, value: string) => navigate(facetPath(facet, value), { modal: true }),
    [navigate],
  )

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
        if (needsReview?.file) openItem(needsReview.file)
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
    [refresh, showUndo, openItem],
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

  // A page was entered by URL, so there is no history entry to go back to — leaving it means
  // navigating to the list.
  const exitPage = () => navigate('/')

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
        onOpenUnconfirmed={() => navigate(UNCONFIRMED_PATH, { modal: true })}
        onNewTask={() => setCreatingNew(true)}
        unconfirmedCount={unconfirmedCount}
      />
      <div className="flex min-h-0 flex-1">
        <BucketRail
          buckets={buckets}
          active={bucket}
          onSelect={selectBucket}
          projects={projectSuggestions}
          onOpenProject={value => openFacet('project', value)}
        />
        {pageMode && route.kind === 'unconfirmed' ? null : pageMode && editingFile ? (
          <CardPage
            key={`${editingFile}-${navVersion}`}
            file={editingFile}
            tagSuggestions={tagSuggestions}
            projectSuggestions={projectSuggestions}
            locationSuggestions={locationSuggestions}
            areaOptions={areaOptions}
            onClose={exitPage}
            onSaved={() => void refresh()}
            onNavigate={navigate}
          />
        ) : pageMode && facetView ? (
          <FacetView
            facet={facetView.facet}
            value={facetView.value}
            buckets={buckets}
            onOpenItem={openItem}
            onOpenProject={value => openFacet('project', value)}
            onOpenLocation={value => openFacet('location', value)}
            onComplete={complete}
            onDismiss={remove}
            onClose={exitPage}
            frame={pageFrame}
          />
        ) : (
        <main className="flex min-w-0 flex-1 flex-col">
          <AreaBar areas={areaOptions} onOpenArea={value => openFacet('area', value)} />
          <ItemList
            bucket={bucket}
            items={visibleItems}
            allItems={bucketItems}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            onViewTagAcross={value => openFacet('tag', value)}
            onOpenItem={openItem}
            onOpenProject={value => openFacet('project', value)}
            onOpenLocation={value => openFacet('location', value)}
            onComplete={complete}
            onDismiss={remove}
            onFocus={bucket === 'today' ? startFocus : undefined}
          />
          <OpsFeed
            entries={feed}
            onOpenItem={openItem}
            onConfirmOp={confirmOp}
            onCancelOp={(id, i) => resolveOp(id, i, 'Cancelled — no changes')}
          />
          <CaptureBar busy={capturing} onSend={sendCapture} onError={captureError} />
        </main>
        )}
      </div>

      {((editingFile && modal) || creatingNew) && (
        <EditModal
          key={creatingNew ? 'new' : `${editingFile}-${navVersion}`}
          file={creatingNew ? null : editingFile}
          tagSuggestions={tagSuggestions}
          projectSuggestions={projectSuggestions}
          locationSuggestions={locationSuggestions}
          areaOptions={areaOptions}
          onClose={() => (creatingNew ? setCreatingNew(false) : back())}
          onSaved={() => void refresh()}
          onNavigate={navigate}
        />
      )}
      {searchOpen && (
        <SearchOverlay buckets={buckets} onOpenItem={openItem} onClose={() => setSearchOpen(false)} />
      )}
      {facetView && modal && (
        <FacetView
          facet={facetView.facet}
          value={facetView.value}
          buckets={buckets}
          onOpenItem={openItem}
          onOpenProject={value => openFacet('project', value)}
          onOpenLocation={value => openFacet('location', value)}
          onComplete={complete}
          onDismiss={remove}
          onClose={back}
        />
      )}
      {triageOpen && <TriageOverlay onClose={() => setTriageOpen(false)} onChanged={() => void refresh()} />}
      {route.kind === 'unconfirmed' && (
        // The queue is a history entry, so opening a card from it just pushes on top: the queue
        // unmounts, and closing the card (history.back) brings it back — remounted, hence refetched.
        <UnconfirmedQueue
          onClose={modal ? back : exitPage}
          onChanged={() => void refresh()}
          onEdit={openItem}
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

import { Bot, RotateCcw, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getEvents } from '../lib/api'
import type { EventEntry } from '../lib/types'
import { Overlay } from './Overlay'

const OP_LABEL: Record<string, string> = {
  create: 'created',
  move: 'moved',
  done: 'done',
  dismiss: 'dismissed',
  edit: 'edited',
  update: 'updated',
  patch: 'patched',
}

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface Props {
  onClose: () => void
}

/** Durable cross-session history, backed by GET /api/events — distinct from OpsFeed, which is this session's capture feed only. */
export function HistoryPanel({ onClose }: Props) {
  const [events, setEvents] = useState<EventEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getEvents({ limit: 100 })
      .then(setEvents)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <Overlay title="History" onClose={onClose} wide>
      <div className="flex flex-col gap-1 p-4">
        {error && <div className="text-[12.5px] text-discard">Failed to load: {error}</div>}
        {!events && !error && <div className="font-mono text-[12px] text-ink-faint">loading…</div>}
        {events && events.length === 0 && (
          <div className="rounded-card border border-dashed border-line px-3 py-2 text-[12px] text-ink-faint">
            Nothing yet — every create, move, done, dismiss, and undo lands here.
          </div>
        )}
        {events?.slice().reverse().map(e => (
          <EventRow key={e.id} event={e} />
        ))}
      </div>
    </Overlay>
  )
}

function EventRow({ event }: { event: EventEntry }) {
  const isUndo = event.kind === 'undo'
  return (
    <div className="flex items-center gap-2.5 rounded-card border border-line bg-bg px-3 py-2">
      {isUndo ? (
        <RotateCcw size={12} className="shrink-0 text-ink-faint" />
      ) : event.actor === 'llm' ? (
        <Bot size={12} className="shrink-0 text-accent" />
      ) : (
        <User size={12} className="shrink-0 text-ink-faint" />
      )}
      <span className="shrink-0 font-mono text-[10.5px] text-ink-faint">
        {isUndo ? 'undo' : (event.op && OP_LABEL[event.op]) || event.op}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{event.title || event.file}</span>
      {event.confirmation === 'confirmed' && (
        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[9.5px] text-accent">
          approved
        </span>
      )}
      <span className="shrink-0 font-mono text-[10.5px] text-ink-faint">{timeAgo(event.ts)}</span>
    </div>
  )
}

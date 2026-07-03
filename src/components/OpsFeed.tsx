import { AlertTriangle, Check, ChevronDown, ChevronUp, FileText, X } from 'lucide-react'
import { useState } from 'react'
import { BUCKET_META } from '../lib/bucketMeta'
import type { Bucket, Op } from '../lib/types'

export interface FeedEntry {
  id: string
  text: string
  time: string
  status: 'pending' | 'done' | 'error'
  fallback?: boolean
  ops?: Op[]
  error?: string
  /** Indexes of ops whose confirmation was resolved, mapped to the outcome label. */
  resolved?: Record<number, string>
}

interface Props {
  entries: FeedEntry[]
  onOpenItem: (file: string) => void
  onConfirmOp: (entryId: string, opIndex: number, op: Op) => void
  onCancelOp: (entryId: string, opIndex: number) => void
  onReviewItem: (entryId: string, opIndex: number, op: Op) => void
}

/** Capture results feed: collapsed shows the latest capture, expanded shows the session history. */
export function OpsFeed({ entries, onOpenItem, onConfirmOp, onCancelOp, onReviewItem }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (entries.length === 0) return null

  const visible = expanded ? entries : entries.slice(-1)

  return (
    <div className="shrink-0 border-t border-line bg-bg/80">
      <div className="mx-auto max-w-2xl px-4">
        {entries.length > 1 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex w-full items-center justify-center gap-1 py-1 font-mono text-[10.5px] text-ink-faint transition-colors hover:text-ink-muted"
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
            {expanded ? 'collapse' : `history ${entries.length}`}
          </button>
        )}
        <div className={`flex flex-col gap-2 pb-3 ${expanded ? 'max-h-72 overflow-y-auto pt-1' : 'pt-2'}`}>
          {visible.map(entry => (
            <FeedRow
              key={entry.id}
              entry={entry}
              onOpenItem={onOpenItem}
              onConfirmOp={onConfirmOp}
              onCancelOp={onCancelOp}
              onReviewItem={onReviewItem}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function FeedRow({ entry, onOpenItem, onConfirmOp, onCancelOp, onReviewItem }: {
  entry: FeedEntry
  onOpenItem: (file: string) => void
  onConfirmOp: (entryId: string, opIndex: number, op: Op) => void
  onCancelOp: (entryId: string, opIndex: number) => void
  onReviewItem: (entryId: string, opIndex: number, op: Op) => void
}) {
  return (
    <div className="animate-fade-up">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="font-mono text-[10.5px] text-ink-faint">{entry.time}</span>
        <span className="truncate text-[12px] text-ink-muted">{entry.text}</span>
        {entry.fallback && <span className="font-mono text-[10px] text-waiting">fallback</span>}
      </div>

      {entry.status === 'pending' && (
        <div className="font-mono text-[11px] text-ink-faint">classifying…</div>
      )}

      {entry.status === 'error' && (
        <div className="flex items-center gap-2 rounded-card border border-discard/30 bg-discard/10 px-3 py-2 text-[12px] text-discard">
          <AlertTriangle size={13} />
          {entry.error ?? 'Something went wrong'} — is the Java server running on :8080?
        </div>
      )}

      {entry.status === 'done' && (entry.ops?.length ?? 0) === 0 && (
        <div className="rounded-card border border-line px-3 py-2 text-[12px] text-ink-muted">
          Nothing to file from that — try rephrasing.
        </div>
      )}

      {entry.status === 'done' &&
        entry.ops?.map((op, i) =>
          op.requires_confirmation && !entry.resolved?.[i] ? (
            <ConfirmCard key={i} op={op} onConfirm={() => onConfirmOp(entry.id, i, op)} onCancel={() => onCancelOp(entry.id, i)} />
          ) : op.op === 'create' && op.confirmed === false && !entry.resolved?.[i] ? (
            <ReviewCard key={i} op={op} onReview={() => onReviewItem(entry.id, i, op)} />
          ) : (
            <OpCard key={i} op={op} outcome={entry.resolved?.[i]} onOpenItem={onOpenItem} />
          ),
        )}
    </div>
  )
}

const OPENABLE_OPS = new Set(['create', 'edit', 'update', 'move', 'done'])

function OpCard({ op, outcome, onOpenItem }: { op: Op; outcome?: string; onOpenItem: (file: string) => void }) {
  const displayBucket = op.new_bucket ?? op.bucket
  const bucket = displayBucket && displayBucket in BUCKET_META ? (displayBucket as Bucket) : null
  const meta = bucket ? BUCKET_META[bucket] : null
  const targetFile = op.file ?? op.target_file
  const clickable = !!targetFile && !op.error && OPENABLE_OPS.has(op.op) && (op.op !== 'create' || !!op.filed)
  const editDetail = (op.op === 'edit' || op.op === 'update') && outcome?.startsWith('Applied') ? op.proposed_body : undefined

  return (
    <div
      onClick={clickable ? () => onOpenItem(targetFile!) : undefined}
      className={`mb-1 rounded-card border border-line bg-surface px-3 py-2 ${
        clickable ? 'cursor-pointer transition-colors hover:border-line-strong' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[10.5px] text-ink-faint">{op.op}</span>
        {meta && (
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[10px]"
            style={{ background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color }}
          >
            {bucket}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
          {outcome ?? op.title ?? op.file ?? op.message ?? op.error ?? ''}
        </span>
        {op.error ? (
          <AlertTriangle size={12} className="shrink-0 text-discard" />
        ) : op.filed ? (
          <Check size={12} className="shrink-0 text-done" />
        ) : outcome ? null : (
          <X size={12} className="shrink-0 text-ink-faint" />
        )}
        {clickable && <FileText size={12} className="shrink-0 text-ink-faint" />}
      </div>
      {editDetail && (
        <div className="mt-1 truncate font-mono text-[11px] text-ink-faint">{editDetail}</div>
      )}
    </div>
  )
}

function ConfirmCard({ op, onConfirm, onCancel }: { op: Op; onConfirm: () => void; onCancel: () => void }) {
  const isDismiss = op.op === 'dismiss'
  return (
    <div className="mb-1 rounded-card border border-waiting/40 bg-surface px-3 py-2.5">
      <div className="mb-2 text-[12px] text-ink">
        {isDismiss ? (
          <>Discard <span className="text-discard">“{op.title ?? op.target_file}”</span>? You can undo this afterwards from the toast or <code>POST /api/undo</code>.</>
        ) : (
          <>Apply this edit to <span className="text-waiting">“{op.title ?? op.target_file}”</span>?</>
        )}
      </div>
      {!isDismiss && (
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-line bg-bg p-2">
            <div className="mb-1 font-mono text-[9.5px] tracking-wide text-ink-faint uppercase">current</div>
            <pre className="max-h-24 overflow-y-auto font-mono text-[11px] whitespace-pre-wrap text-ink-muted">{op.current_body || '(empty)'}</pre>
          </div>
          <div className="rounded-md border border-line bg-bg p-2">
            <div className="mb-1 font-mono text-[9.5px] tracking-wide text-ink-faint uppercase">proposed</div>
            <pre className="max-h-24 overflow-y-auto font-mono text-[11px] whitespace-pre-wrap text-ink">{op.proposed_body || '(empty)'}</pre>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="rounded-md bg-accent px-3 py-1 text-[12px] text-bg transition-opacity hover:opacity-90"
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-line px-3 py-1 text-[12px] text-ink-muted transition-colors hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Shown when create returns confirmed: false — the task is already filed, low classifier confidence just flags it for a quick look. */
function ReviewCard({ op, onReview }: { op: Op; onReview: () => void }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2 rounded-card border border-waiting/40 bg-surface px-3 py-2.5">
      <div className="min-w-0 text-[12px] text-ink">
        Filed <span className="text-waiting">“{op.title ?? op.file}”</span> with low confidence — look right?
      </div>
      <button
        onClick={onReview}
        className="shrink-0 rounded-md bg-accent px-3 py-1 text-[12px] text-bg transition-opacity hover:opacity-90"
      >
        Looks good
      </button>
    </div>
  )
}

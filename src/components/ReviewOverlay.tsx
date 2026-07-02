import { useCallback, useEffect, useState } from 'react'
import { dismissItem, getReview, markDone, moveItem } from '../lib/api'
import type { Item, ReviewData } from '../lib/types'
import { Overlay } from './Overlay'

interface Props {
  onClose: () => void
  onChanged: () => void
}

export function ReviewOverlay({ onClose, onChanged }: Props) {
  const [data, setData] = useState<ReviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setData(null)
    setError(null)
    getReview()
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(load, [load])

  async function act(action: 'backlog' | 'someday' | 'done' | 'dismiss', item: Item) {
    try {
      if (action === 'done') await markDone(item.file)
      else if (action === 'dismiss') await dismissItem(item.file)
      else await moveItem(item.file, action)
      onChanged()
      load()
    } catch {
      // row stays; user can retry
    }
  }

  const stats = data?.week_stats

  return (
    <Overlay
      title="Weekly Review"
      onClose={onClose}
      wide
      headerExtra={
        stats ? (
          <div className="flex gap-3 font-mono text-[11px]">
            <span className="text-waiting">{stats.stale ?? data?.stale_today.length ?? 0} stale</span>
            <span className="text-done">{stats.completed} completed</span>
            <span className="text-backlog">{stats.due_soon ?? data?.due_this_week.length ?? 0} due soon</span>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-5 p-5">
        {error && <div className="text-[12.5px] text-discard">Failed to load: {error}</div>}
        {!data && !error && <div className="font-mono text-[12px] text-ink-faint">loading…</div>}
        {data && (
          <>
            <Section title="Stale — 3+ days in Today" items={data.stale_today} accent="var(--color-waiting)">
              {item => (
                <div className="flex shrink-0 gap-1.5">
                  <RowBtn onClick={() => act('backlog', item)}>Backlog</RowBtn>
                  <RowBtn onClick={() => act('someday', item)}>Someday</RowBtn>
                  <RowBtn onClick={() => act('done', item)} tone="done">Done</RowBtn>
                  <RowBtn onClick={() => act('dismiss', item)} tone="discard">Dismiss</RowBtn>
                </div>
              )}
            </Section>
            <Section title="Due this week" items={data.due_this_week} accent="var(--color-backlog)" />
            <Section title="Completed this week" items={data.completed_this_week} accent="var(--color-done)" />
          </>
        )}
      </div>
    </Overlay>
  )
}

function Section({ title, items, accent, children }: {
  title: string
  items: Item[]
  accent: string
  children?: (item: Item) => React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[12.5px] font-medium" style={{ color: accent }}>{title}</span>
        <span className="font-mono text-[11px] text-ink-faint">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-card border border-dashed border-line px-3 py-2 text-[12px] text-ink-faint">None</div>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map(item => (
            <div key={item.file} className="flex items-center gap-3 rounded-card border border-line bg-bg px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{item.title ?? item.file}</span>
              {item.due && <span className="shrink-0 font-mono text-[11px] text-waiting">{item.due}</span>}
              {children?.(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RowBtn({ onClick, tone, children }: { onClick: () => void; tone?: 'done' | 'discard'; children: React.ReactNode }) {
  const toneClass =
    tone === 'done'
      ? 'text-done border-done/40 hover:bg-done/10'
      : tone === 'discard'
        ? 'text-discard border-discard/40 hover:bg-discard/10'
        : 'text-ink-muted border-line hover:bg-raised'
  return (
    <button onClick={onClick} className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${toneClass}`}>
      {children}
    </button>
  )
}

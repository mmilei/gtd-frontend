import { Check, Plus, SkipForward, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { markDone } from '../lib/api'
import { celebrate } from '../lib/celebration'
import { playBoink, playChime } from '../lib/sound'
import { formatMinutes } from '../lib/todayOrder'
import type { Item } from '../lib/types'

interface Props {
  queue: Item[]
  startIndex: number
  onClose: () => void
  onChanged: () => void
}

function fmt(totalSeconds: number): string {
  const m = Math.floor(Math.abs(totalSeconds) / 60)
  const s = Math.abs(totalSeconds) % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Single-task focus session over the ordered Today queue.
 * Countdown when the task has an estimate, stopwatch when it doesn't.
 * Overtime never scolds — the chime marks the boundary, the color shifts, that's it.
 */
export function FocusOverlay({ queue, startIndex, onClose, onChanged }: Props) {
  const [index, setIndex] = useState(startIndex)
  const [doneCount, setDoneCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  const item: Item | undefined = queue[index]
  const estimate = item?.estimate_minutes ?? null

  // seconds remaining (countdown) or elapsed (stopwatch, negative estimate marker)
  const [seconds, setSeconds] = useState(0)
  const [extraMinutes, setExtraMinutes] = useState(0)
  const chimed = useRef(false)

  useEffect(() => {
    setSeconds(0)
    setExtraMinutes(0)
    chimed.current = false
  }, [index])

  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [index])

  const budgetSeconds = estimate ? (estimate + extraMinutes) * 60 : null
  const remaining = budgetSeconds !== null ? budgetSeconds - seconds : null
  const overtime = remaining !== null && remaining < 0

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !chimed.current) {
      chimed.current = true
      playChime()
    }
  }, [remaining])

  const advance = useCallback(() => {
    if (index + 1 < queue.length) setIndex(i => i + 1)
    else onClose()
  }, [index, queue.length, onClose])

  const complete = useCallback(async () => {
    if (!item || busy) return
    setBusy(true)
    try {
      await markDone(item.file)
      playBoink()
      celebrate()
      setDoneCount(c => c + 1)
      setCelebrating(true)
      onChanged()
      setTimeout(() => {
        setCelebrating(false)
        advance()
        setBusy(false)
      }, 700)
    } catch {
      setBusy(false)
    }
  }, [item, busy, advance, onChanged])

  const skip = useCallback(() => {
    if (!busy) advance()
  }, [busy, advance])

  const extend = useCallback(() => {
    chimed.current = false
    setExtraMinutes(m => m + 5)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'Enter') complete()
      else if (e.key === 's' || e.key === 'S') skip()
      else if (e.key === '+' || e.key === '=') extend()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, complete, skip, extend])

  if (!item) return null

  const timerLabel = remaining !== null ? fmt(remaining) : fmt(seconds)
  const timerColor = celebrating
    ? 'text-done'
    : overtime
      ? 'text-waiting'
      : remaining !== null
        ? 'text-ink'
        : 'text-ink-muted'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-mono text-[11px] text-ink-faint">
          focus · {index + 1}/{queue.length}
          {doneCount > 0 && <span className="text-done"> · {doneCount} done</span>}
        </span>
        <button
          onClick={onClose}
          aria-label="Exit focus"
          className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-24">
        <div
          className={`font-mono text-[96px] leading-none font-medium tabular-nums transition-colors ${timerColor}`}
        >
          {celebrating ? '✓' : timerLabel}
        </div>
        <div className="mt-2 font-mono text-[12px] text-ink-faint">
          {estimate
            ? overtime
              ? `over the ${formatMinutes(estimate + extraMinutes)} estimate — no rush`
              : `of ${formatMinutes(estimate + extraMinutes)}`
            : 'no estimate — free run'}
        </div>

        <h1 className="mt-10 max-w-xl text-center font-display text-[26px] leading-snug font-semibold text-ink">
          {item.title ?? item.file}
        </h1>
        {item.body?.trim() && (
          <p className="mt-3 max-w-lg text-center text-[13px] leading-relaxed text-ink-muted line-clamp-3">
            {item.body.trim()}
          </p>
        )}

        <div className="mt-12 flex items-center gap-3">
          <button
            onClick={complete}
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-[14px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check size={16} /> Done
            <kbd className="ml-1 font-mono text-[10px] opacity-70">↵</kbd>
          </button>
          {estimate && (
            <button
              onClick={extend}
              className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2.5 text-[13px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              <Plus size={14} /> 5 min
              <kbd className="ml-1 font-mono text-[10px] text-ink-faint">+</kbd>
            </button>
          )}
          <button
            onClick={skip}
            className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2.5 text-[13px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <SkipForward size={14} /> Skip
            <kbd className="ml-1 font-mono text-[10px] text-ink-faint">S</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}

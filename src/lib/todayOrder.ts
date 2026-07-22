import type { Item, Priority } from './types'

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

/**
 * Priority-only order for buckets with no other sort (backlog/waiting/someday/reference).
 * Unprioritized items sink to the bottom, keeping their original relative order (stable sort).
 * `today` is not touched here — it keeps orderToday() (due/today_since/estimate); combining the
 * two is deliberately left unresolved, see the backlog ticket this PR spawns.
 */
export function orderByPriority(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const rankA = a.priority ? PRIORITY_RANK[a.priority] : 3
    const rankB = b.priority ? PRIORITY_RANK[b.priority] : 3
    return rankA - rankB
  })
}

/**
 * Execution order for Today (the app decides so the user doesn't have to):
 * due date first, then longest-sitting items, then shortest estimate.
 */
export function orderToday(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const dueA = a.due ?? '9999-99-99'
    const dueB = b.due ?? '9999-99-99'
    if (dueA !== dueB) return dueA < dueB ? -1 : 1

    const sinceA = a.today_since ?? '9999-99-99'
    const sinceB = b.today_since ?? '9999-99-99'
    if (sinceA !== sinceB) return sinceA < sinceB ? -1 : 1

    const estA = a.estimate_minutes ?? Number.MAX_SAFE_INTEGER
    const estB = b.estimate_minutes ?? Number.MAX_SAFE_INTEGER
    return estA - estB
  })
}

export interface DayProjection {
  totalMinutes: number
  estimatedCount: number
  unestimatedCount: number
  /** Local wall-clock finish time, e.g. "18:42". */
  finishLabel: string
}

/** Llama Life pattern: total estimated work + projected wall-clock finish time. */
export function projectDay(items: Item[]): DayProjection | null {
  const estimates = items
    .map(i => i.estimate_minutes)
    .filter((m): m is number => typeof m === 'number' && m > 0)
  if (estimates.length === 0) return null

  const totalMinutes = estimates.reduce((a, b) => a + b, 0)
  const finish = new Date(Date.now() + totalMinutes * 60_000)
  return {
    totalMinutes,
    estimatedCount: estimates.length,
    unestimatedCount: items.length - estimates.length,
    finishLabel: finish.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

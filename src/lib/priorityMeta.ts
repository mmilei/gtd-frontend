import type { Priority } from './types'

export interface PriorityMeta {
  label: string
  /** color-mix() percentage against --color-accent — increasing intensity, not a new hue per level. */
  mix: number
}

/** Importance only. Reuses --color-accent at increasing intensity instead of 3 new hardcoded hues. */
export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  low: { label: 'Low', mix: 25 },
  medium: { label: 'Medium', mix: 55 },
  high: { label: 'High', mix: 100 },
}

export const PRIORITY_ORDER: Priority[] = ['low', 'medium', 'high']

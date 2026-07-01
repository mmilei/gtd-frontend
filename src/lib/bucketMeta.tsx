import type { LucideIcon } from 'lucide-react'
import { BookOpen, Hourglass, Inbox, Sprout, Sun } from 'lucide-react'
import type { Bucket } from './types'

export interface BucketMeta {
  label: string
  /** CSS color value from the design tokens. */
  color: string
  Icon: LucideIcon
}

/** Single source of truth for bucket presentation (was duplicated 3× in the vanilla app). */
export const BUCKET_META: Record<Bucket, BucketMeta> = {
  today: { label: 'Today', color: 'var(--color-today)', Icon: Sun },
  backlog: { label: 'Backlog', color: 'var(--color-backlog)', Icon: Inbox },
  waiting: { label: 'Waiting', color: 'var(--color-waiting)', Icon: Hourglass },
  someday: { label: 'Someday', color: 'var(--color-someday)', Icon: Sprout },
  reference: { label: 'Reference', color: 'var(--color-reference)', Icon: BookOpen },
}

export const BUCKET_ORDER: Bucket[] = ['today', 'backlog', 'waiting', 'someday', 'reference']

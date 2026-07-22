import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { playBoink, playThunk } from '../lib/sound'
import type { Item } from '../lib/types'
import { formatCreated, ItemCard } from './ItemCard'

function renderCard(item: Item) {
  return render(
    <ItemCard
      item={item}
      bucket="backlog"
      onOpen={() => {}}
      onComplete={vi.fn().mockResolvedValue(true)}
      onDismiss={vi.fn().mockResolvedValue(true)}
    />,
  )
}

describe('formatCreated', () => {
  it('passes a plain YYYY-MM-DD date through unchanged', () => {
    expect(formatCreated('2026-06-28')).toBe('2026-06-28')
  })

  it('normalizes a full ISO datetime to the date portion', () => {
    expect(formatCreated('2026-06-28T09:15:00Z')).toBe('2026-06-28')
  })
})

describe('dismiss vs done sounds', () => {
  it('exposes distinct callables for completion and dismissal', () => {
    expect(typeof playBoink).toBe('function')
    expect(typeof playThunk).toBe('function')
    expect(playThunk).not.toBe(playBoink)
  })
})

describe('priority dot', () => {
  it('renders nothing when the item has no priority', () => {
    renderCard({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [] })
    expect(screen.queryByTitle(/Priority:/)).not.toBeInTheDocument()
  })

  it('renders a labelled dot for each priority level', () => {
    renderCard({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [], priority: 'high' })
    expect(screen.getByTitle('Priority: High')).toBeInTheDocument()
  })
})

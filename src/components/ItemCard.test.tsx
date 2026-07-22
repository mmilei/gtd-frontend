import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Item } from '../lib/types'
import { ItemCard } from './ItemCard'

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

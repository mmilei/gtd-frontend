import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { playBoink, playThunk } from '../lib/sound'
import type { Item } from '../lib/types'
import { flattenBody, formatCreated, ItemCard } from './ItemCard'

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

describe('body preview', () => {
  const TAIL = 'the last sentence only visible once expanded.'
  const LONG = `# Heading\n- a bullet\n${'filler text that pushes the body well past the collapsed cut. '.repeat(4)}${TAIL}`

  it('flattens headings and bullets to plain text', () => {
    expect(flattenBody('# Title\n- one\n* two\nplain')).toBe('Title one two plain')
  })

  it('shows a trimmed body collapsed and the whole body once expanded', async () => {
    renderCard({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [], body: LONG })

    expect(screen.getByText(/…$/)).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(TAIL))).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))

    expect(screen.getByText(new RegExp(TAIL))).toBeInTheDocument()
    expect(screen.queryByText(/…$/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument()
  })

  it('keeps short bodies static, with no expand control', () => {
    renderCard({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [], body: 'short note' })
    expect(screen.getByText('short note')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show more/ })).not.toBeInTheDocument()
  })

  it('renders bold, code and wikilinks instead of their literal markers', () => {
    renderCard({ file: 't.md', title: 'Task', bucket: 'backlog', tags: [], body: 'see **urgent** run `npm test` on [[Project X]]' })

    expect(screen.getByText('urgent').tagName).toBe('STRONG')
    expect(screen.getByText('npm test').tagName).toBe('CODE')

    const link = screen.getByText('Project X')
    expect(link.className).toContain('text-accent')

    expect(screen.queryByText(/\*\*urgent\*\*/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\[\[Project X\]\]/)).not.toBeInTheDocument()
  })
})

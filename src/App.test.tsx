import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { BucketsMap, Item } from './lib/types'

// Spread the real module so every named import the component tree pulls in still resolves;
// only the calls this suite exercises are stubbed.
vi.mock('./lib/api', async () => {
  const actual = await vi.importActual<typeof import('./lib/api')>('./lib/api')
  return {
    ...actual,
    getBuckets: vi.fn(),
    getToday: vi.fn(),
    getAreas: vi.fn(),
    getChatHistory: vi.fn(),
    fetchItem: vi.fn(),
  }
})

import { fetchItem, getAreas, getBuckets, getChatHistory, getToday } from './lib/api'

const ITEM: Item = { file: '20260824-101500-buy-screws.md', title: 'Buy screws', bucket: 'today', tags: [] }
const BUCKETS: BucketsMap = { today: [ITEM], backlog: [], waiting: [], someday: [], reference: [] }

const OPEN_CARD = { name: `Open "${ITEM.title}"` }

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
  vi.mocked(getBuckets).mockResolvedValue(BUCKETS)
  vi.mocked(getToday).mockResolvedValue([ITEM])
  vi.mocked(getAreas).mockResolvedValue([])
  vi.mocked(getChatHistory).mockResolvedValue([])
  vi.mocked(fetchItem).mockResolvedValue(ITEM)
})

describe('opening a card from inside the app', () => {
  it('pushes the card URL with modal: true and mounts the editor over the list', async () => {
    const user = userEvent.setup()
    const pushState = vi.spyOn(window.history, 'pushState')
    render(<App />)

    await user.click(await screen.findByRole('button', OPEN_CARD))

    expect(pushState).toHaveBeenCalledWith({ modal: true }, '', `/today/${ITEM.file}`)
    // editor is up…
    expect(await screen.findByPlaceholderText('Title')).toBeInTheDocument()
    // …and the list is still mounted behind it
    expect(screen.getByRole('button', OPEN_CARD)).toBeInTheDocument()
  })

  it('closes the editor by leaving the history entry it pushed', async () => {
    const user = userEvent.setup()
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    render(<App />)

    await user.click(await screen.findByRole('button', OPEN_CARD))
    await screen.findByPlaceholderText('Title')
    await user.click(screen.getByText('Cancel'))

    expect(back).toHaveBeenCalled()
  })
})

describe('opening a card URL directly', () => {
  it('renders it as a page, without mounting the list', async () => {
    window.history.replaceState(null, '', `/today/${ITEM.file}`)
    render(<App />)

    expect(await screen.findByText(ITEM.file)).toBeInTheDocument()
    expect(screen.queryByRole('button', OPEN_CARD)).not.toBeInTheDocument()
  })
})

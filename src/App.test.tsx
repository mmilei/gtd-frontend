import { render, screen, within } from '@testing-library/react'
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
    getUnconfirmed: vi.fn(),
  }
})

import { fetchItem, getAreas, getBuckets, getChatHistory, getToday, getUnconfirmed } from './lib/api'

const ITEM: Item = { file: '20260824-101500-buy-screws.md', title: 'Buy screws', bucket: 'today', tags: [] }
const BUCKETS: BucketsMap = { today: [ITEM], backlog: [], waiting: [], someday: [], reference: [] }

const OPEN_CARD = { name: `Open "${ITEM.title}"` }

beforeEach(() => {
  vi.clearAllMocks()
  // Spies on history.* are per-test; without this they leak into the next test and a real
  // back-navigation silently becomes the previous test's no-op stub.
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
  vi.mocked(getBuckets).mockResolvedValue(BUCKETS)
  vi.mocked(getToday).mockResolvedValue([ITEM])
  vi.mocked(getAreas).mockResolvedValue([])
  vi.mocked(getChatHistory).mockResolvedValue([])
  vi.mocked(fetchItem).mockResolvedValue(ITEM)
  vi.mocked(getUnconfirmed).mockResolvedValue([])
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

describe('opening a card from the unconfirmed queue', () => {
  const PENDING: Item = {
    file: '20260824-090000-call-the-vet.md',
    title: 'Call the vet',
    bucket: 'backlog',
    tags: [],
    confirmed: false,
  }
  const QUEUE = { name: 'Unconfirmed' }

  beforeEach(() => {
    vi.mocked(getBuckets).mockResolvedValue({ ...BUCKETS, backlog: [PENDING] })
    vi.mocked(getUnconfirmed).mockResolvedValue([PENDING])
    vi.mocked(fetchItem).mockResolvedValue(PENDING)
  })

  it('comes back to the queue when the card is closed, not to the list', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /^Unconfirmed/ }))
    expect(await screen.findByRole('dialog', QUEUE)).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /^Edit/ }))
    expect(await screen.findByPlaceholderText('Title')).toHaveValue(PENDING.title)
    expect(screen.queryByRole('dialog', QUEUE)).not.toBeInTheDocument()

    await user.click(screen.getByText('Cancel'))

    // the queue is back — the editor is gone and the list did not take its place
    expect(await screen.findByRole('dialog', QUEUE)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument()
    // and it refetched, so items handled in the editor drop out of the review
    expect(vi.mocked(getUnconfirmed)).toHaveBeenCalledTimes(2)
  })
})

describe('opening a link from inside a directly-entered page (mamushka)', () => {
  const CHILD_TITLE = 'Order hinges'
  const CHILD: Item = { file: '20260824-110000-order-hinges.md', title: CHILD_TITLE, bucket: 'today', tags: [] }
  const PARENT: Item = {
    ...ITEM,
    links: [{ name: CHILD_TITLE, kind: 'TASK', path: `today/${CHILD.file}`, obsidianUri: '' }],
  }

  it('stacks the modal on top of the page instead of dropping the page for the list', async () => {
    window.history.replaceState(null, '', `/today/${PARENT.file}`)
    vi.mocked(fetchItem).mockImplementation(async file => (file === CHILD.file ? CHILD : PARENT))
    const user = userEvent.setup()
    render(<App />)

    expect(await within(screen.getByRole('main')).findByPlaceholderText('Title')).toHaveValue(PARENT.title)

    await user.click(await screen.findByRole('link', { name: new RegExp(CHILD_TITLE) }))

    // the child opens as a modal on top…
    expect(await within(await screen.findByRole('dialog')).findByPlaceholderText('Title')).toHaveValue(CHILD_TITLE)
    // …and the parent page is still there underneath it — never swapped for the plain item list
    expect(within(screen.getByRole('main')).getByPlaceholderText('Title')).toHaveValue(PARENT.title)
    expect(screen.queryByRole('button', OPEN_CARD)).not.toBeInTheDocument()
  })
})

/** The editable fields rendered inside a surface — same list means the same form component. */
const formFields = (root: HTMLElement) =>
  [...root.querySelectorAll('input, textarea, select')].map(
    el => `${el.tagName}:${el.getAttribute('placeholder') ?? el.getAttribute('type') ?? ''}`,
  )

describe('opening a card URL directly', () => {
  it('renders it as a page inside the app chrome, without mounting the list', async () => {
    window.history.replaceState(null, '', `/today/${ITEM.file}`)
    render(<App />)

    // the card editor is the page…
    expect(await screen.findByPlaceholderText('Title')).toHaveValue(ITEM.title)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // …wrapped in the same chrome the list gets…
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Buckets' })).toBeInTheDocument()
    // …and the item list is never mounted behind it
    expect(screen.queryByRole('button', OPEN_CARD)).not.toBeInTheDocument()
  })

  it('renders the same edit form the modal does, not a second implementation', async () => {
    window.history.replaceState(null, '', `/today/${ITEM.file}`)
    const page = render(<App />)
    await screen.findByPlaceholderText('Title')
    const onPage = formFields(screen.getByRole('main'))
    page.unmount()

    window.history.replaceState(null, '', '/')
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', OPEN_CARD))
    await screen.findByPlaceholderText('Title')

    expect(onPage.length).toBeGreaterThan(0)
    expect(formFields(screen.getByRole('dialog'))).toEqual(onPage)
  })

  it('leaves the page for the list instead of walking out of the app', async () => {
    window.history.replaceState(null, '', `/today/${ITEM.file}`)
    const pushState = vi.spyOn(window.history, 'pushState')
    const user = userEvent.setup()
    render(<App />)

    await screen.findByPlaceholderText('Title')
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(pushState).toHaveBeenCalledWith({ modal: false }, '', '/')
    expect(await screen.findByRole('button', OPEN_CARD)).toBeInTheDocument()
  })
})

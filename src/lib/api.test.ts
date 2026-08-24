import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBuckets } from './api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('request', () => {
  it('bypasses the HTTP cache on every call', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

    await getBuckets()

    expect(fetchSpy).toHaveBeenCalledWith('/api/buckets', expect.objectContaining({ cache: 'no-store' }))
  })
})

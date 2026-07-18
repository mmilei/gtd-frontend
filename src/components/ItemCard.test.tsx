import { describe, expect, it } from 'vitest'
import { playBoink, playThunk } from '../lib/sound'
import { formatCreated } from './ItemCard'

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

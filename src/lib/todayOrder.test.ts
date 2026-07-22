import { describe, expect, it } from 'vitest'
import { orderByPriority } from './todayOrder'
import type { Item } from './types'

function item(file: string, priority?: Item['priority']): Item {
  return { file, bucket: 'backlog', tags: [], priority }
}

describe('orderByPriority', () => {
  it('sorts high before medium before low before unset', () => {
    const input = [item('low.md', 'low'), item('unset.md'), item('high.md', 'high'), item('medium.md', 'medium')]
    const result = orderByPriority(input).map(i => i.file)
    expect(result).toEqual(['high.md', 'medium.md', 'low.md', 'unset.md'])
  })

  it('does not reorder items that share a priority (stable sort)', () => {
    const input = [item('a.md', 'medium'), item('b.md', 'medium'), item('c.md', 'medium')]
    const result = orderByPriority(input).map(i => i.file)
    expect(result).toEqual(['a.md', 'b.md', 'c.md'])
  })

  it('leaves unset items in their original relative order at the bottom', () => {
    const input = [item('first.md'), item('second.md'), item('high.md', 'high')]
    const result = orderByPriority(input).map(i => i.file)
    expect(result).toEqual(['high.md', 'first.md', 'second.md'])
  })
})

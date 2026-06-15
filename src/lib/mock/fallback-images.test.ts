import { describe, it, expect } from 'vitest'
import { pickFallbackImage } from './fallback-images'

const PICSUM = /^https:\/\/picsum\.photos\/seed\/[^/]+\/\d+\/\d+$/

describe('pickFallbackImage', () => {
  it('回傳 picsum.photos seed URL', () => {
    expect(pickFallbackImage('donation', 'abc')).toMatch(PICSUM)
    expect(pickFallbackImage('item', 'abc')).toMatch(PICSUM)
  })

  it('donation 用 16:9 (640×360)', () => {
    expect(pickFallbackImage('donation', 'x')).toMatch(/\/640\/360$/)
  })

  it('item 用 1:1 (400×400)', () => {
    expect(pickFallbackImage('item', 'x')).toMatch(/\/400\/400$/)
  })

  it('deterministic：同 (kind, id) → 必同結果', () => {
    const id = '11111111-1111-4111-8111-000000000001'
    expect(pickFallbackImage('donation', id)).toBe(
      pickFallbackImage('donation', id),
    )
  })

  it('seed 含 kind 前綴，避免 donation/item 同 id 撞同張', () => {
    const id = 'same-id'
    expect(pickFallbackImage('donation', id)).not.toBe(
      pickFallbackImage('item', id),
    )
  })

  it('不同 id → 不同 URL', () => {
    expect(pickFallbackImage('item', 'a')).not.toBe(
      pickFallbackImage('item', 'b'),
    )
  })

  it('空字串 id 也能回傳有效 URL（不 throw）', () => {
    expect(pickFallbackImage('donation', '')).toMatch(PICSUM)
  })
})

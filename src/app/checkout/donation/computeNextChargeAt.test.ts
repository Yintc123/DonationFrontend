// Spec 009a v0.4 §4.2 — `computeNextChargeAt` is the FE-side mirror of
// [BE 021 §7.7]. UTC + strict less-than (`today < day` → this month; else
// next month). Cases below match the BE table verbatim so demo display
// stays aligned with what BE will eventually write.

import { describe, it, expect } from 'vitest'
import { computeNextChargeAt, fmtDate } from './computeNextChargeAt'

describe('computeNextChargeAt (pure, UTC + strict <)', () => {
  it('今日 = 2026-06-15、billingDay=DAY_16 → 2026-06-16 UTC（今日 < day）', () => {
    const now = new Date('2026-06-15T08:00:00.000Z')
    expect(computeNextChargeAt('DAY_16', now).toISOString()).toBe(
      '2026-06-16T00:00:00.000Z',
    )
  })

  it('今日 = 2026-06-16、billingDay=DAY_16 → 2026-07-16 UTC（當天視已過）', () => {
    const now = new Date('2026-06-16T08:00:00.000Z')
    expect(computeNextChargeAt('DAY_16', now).toISOString()).toBe(
      '2026-07-16T00:00:00.000Z',
    )
  })

  it('今日 = 2026-06-20、billingDay=DAY_16 → 2026-07-16 UTC（已過）', () => {
    const now = new Date('2026-06-20T08:00:00.000Z')
    expect(computeNextChargeAt('DAY_16', now).toISOString()).toBe(
      '2026-07-16T00:00:00.000Z',
    )
  })

  it('今日 = 2026-06-30、billingDay=DAY_6 → 2026-07-06 UTC（月底跨月）', () => {
    const now = new Date('2026-06-30T08:00:00.000Z')
    expect(computeNextChargeAt('DAY_6', now).toISOString()).toBe(
      '2026-07-06T00:00:00.000Z',
    )
  })

  it('年底跨年：2026-12-30 + DAY_6 → 2027-01-06 UTC', () => {
    const now = new Date('2026-12-30T08:00:00.000Z')
    expect(computeNextChargeAt('DAY_6', now).toISOString()).toBe(
      '2027-01-06T00:00:00.000Z',
    )
  })

  it('DAY_26 對應到 26 日', () => {
    const now = new Date('2026-06-10T00:00:00.000Z')
    expect(computeNextChargeAt('DAY_26', now).toISOString()).toBe(
      '2026-06-26T00:00:00.000Z',
    )
  })
})

describe('fmtDate (純 UTC、yyyy/MM/dd)', () => {
  it('UTC 日期格式化跟 toISOString 的日期段一致（避 timezone shift）', () => {
    expect(fmtDate(new Date('2026-06-16T00:00:00.000Z'))).toBe('2026/06/16')
    expect(fmtDate(new Date('2027-01-06T00:00:00.000Z'))).toBe('2027/01/06')
  })

  it('月日補零', () => {
    expect(fmtDate(new Date('2026-01-06T00:00:00.000Z'))).toBe('2026/01/06')
  })
})

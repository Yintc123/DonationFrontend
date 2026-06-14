import { describe, it, expect } from 'vitest'
import { Charity, Donation, Item } from '@/lib/schemas/list'
import { CHARITY_FIXTURES } from './charity-fixtures'
import { DONATION_FIXTURES } from './donation-fixtures'
import { ITEM_FIXTURES } from './item-fixtures'

describe('mock fixtures', () => {
  it('CHARITY_FIXTURES ≥ 8 筆且每筆通過 Charity Zod 驗證', () => {
    expect(CHARITY_FIXTURES.length).toBeGreaterThanOrEqual(8)
    for (const c of CHARITY_FIXTURES) {
      expect(() => Charity.parse(c)).not.toThrow()
    }
  })

  it('DONATION_FIXTURES ≥ 8 筆且每筆通過 Donation Zod 驗證', () => {
    expect(DONATION_FIXTURES.length).toBeGreaterThanOrEqual(8)
    for (const d of DONATION_FIXTURES) {
      expect(() => Donation.parse(d)).not.toThrow()
    }
  })

  it('ITEM_FIXTURES ≥ 8 筆且每筆通過 Item Zod 驗證', () => {
    expect(ITEM_FIXTURES.length).toBeGreaterThanOrEqual(8)
    for (const i of ITEM_FIXTURES) {
      expect(() => Item.parse(i)).not.toThrow()
    }
  })

  it('每組 fixture id 唯一', () => {
    const ids = [...CHARITY_FIXTURES, ...DONATION_FIXTURES, ...ITEM_FIXTURES].map(
      (x) => x.id,
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('Donation / Item 的 charityId 必須對應到某個 Charity', () => {
    const charityIds = new Set(CHARITY_FIXTURES.map((c) => c.id))
    for (const d of DONATION_FIXTURES) {
      expect(charityIds.has(d.charityId)).toBe(true)
    }
    for (const i of ITEM_FIXTURES) {
      expect(charityIds.has(i.charityId)).toBe(true)
    }
  })

  it('fixtures 涵蓋 ≥ 4 個不同 categories（demo / e2e 切換空間）', () => {
    const cats = new Set<string>()
    for (const c of CHARITY_FIXTURES) c.categories?.forEach((k) => cats.add(k))
    for (const d of DONATION_FIXTURES) d.categories?.forEach((k) => cats.add(k))
    for (const i of ITEM_FIXTURES) i.categories?.forEach((k) => cats.add(k))
    expect(cats.size).toBeGreaterThanOrEqual(4)
  })
})

import { describe, it, expect } from 'vitest'
import {
  findCharityById,
  findDonationById,
  findItemById,
} from './find-by-id'
import { CHARITY_FIXTURES } from './charity-fixtures'
import { DONATION_FIXTURES } from './donation-fixtures'
import { ITEM_FIXTURES } from './item-fixtures'

describe('find-by-id', () => {
  it('findCharityById 命中 → 對應 fixture', () => {
    const first = CHARITY_FIXTURES[0]
    expect(findCharityById(first.id)).toEqual(first)
  })

  it('findCharityById 未命中 → undefined', () => {
    expect(findCharityById('00000000-0000-0000-0000-000000000000')).toBeUndefined()
  })

  it('findDonationById 命中', () => {
    const first = DONATION_FIXTURES[0]
    expect(findDonationById(first.id)).toEqual(first)
  })

  it('findItemById 命中', () => {
    const first = ITEM_FIXTURES[0]
    expect(findItemById(first.id)).toEqual(first)
  })

  it('三組 finder 互不混淆（donation id 用 findCharity 找不到）', () => {
    const donation = DONATION_FIXTURES[0]
    expect(findCharityById(donation.id)).toBeUndefined()
  })
})

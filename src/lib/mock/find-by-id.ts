/**
 * Preview-only fixture lookup helpers.
 *
 * 提供詳情頁 (spec 004a/b/c) 在 BFF / TanStack Query 還沒接上前的
 * 靜態查找。spec 002 §6 完成後改用 `fetchCharityDetail(id)` 等。
 */
import type { Charity, Donation, Item } from '@/lib/schemas/list'
import { CHARITY_FIXTURES } from './charity-fixtures'
import { DONATION_FIXTURES } from './donation-fixtures'
import { ITEM_FIXTURES } from './item-fixtures'

export function findCharityById(id: string): Charity | undefined {
  return CHARITY_FIXTURES.find((c) => c.id === id)
}

export function findDonationById(id: string): Donation | undefined {
  return DONATION_FIXTURES.find((d) => d.id === id)
}

export function findItemById(id: string): Item | undefined {
  return ITEM_FIXTURES.find((i) => i.id === id)
}

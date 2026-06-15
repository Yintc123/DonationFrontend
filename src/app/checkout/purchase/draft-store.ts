'use client'

// Spec 009b v0.7 — in-memory draft store for sale-item purchase.
// Same design as donation/draft-store.ts (see that file's header for
// rationale + lifecycle). Peek-not-take, cleared after submit success.

import type { ItemDetail } from '@/lib/schemas/detail'

export type PurchaseDraft = {
  quantity: number
  item: ItemDetail
}

let _draft: PurchaseDraft | null = null

export function setPurchaseDraft(d: PurchaseDraft): void {
  _draft = d
}

export function peekPurchaseDraft(): PurchaseDraft | null {
  return _draft
}

export function clearPurchaseDraft(): void {
  _draft = null
}

export function _resetPurchaseDraftForTest(): void {
  _draft = null
}

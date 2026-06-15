'use client'

// Spec 009a v0.7 — in-memory draft store for the donation confirm flow.
//
// Why not URL query: the previous query-string design (v0.6 and earlier)
// exposed amountTwd / targetType / targetId in the address bar — visible
// in browser history, screenshots, analytics, and shareable links. Moving
// to a module-level singleton keeps the draft entirely client-side and
// dies the moment the JS runtime resets (refresh, tab close, deploy).
//
// Design:
//   - Plain module singleton — no Zustand / context. Sheet writes; confirm
//     page peeks once on mount. No reactivity needed (it's a one-shot
//     handoff, not shared state).
//   - peek (not take): React 19 Strict Mode double-runs effects in dev;
//     a "read+clear" would empty the draft on the second pass and redirect
//     a perfectly valid session away. The store is cleared explicitly:
//       (a) by the hook after a successful submit (avoid resubmit on back)
//       (b) implicitly by the JS runtime resetting on refresh / new tab
//
// Lifecycle:
//   sheet.submit → setDonationDraft({...}) → router.push('/checkout/donation')
//   confirm page mount → peekDonationDraft() → render or redirect('/donation')
//   confirm submit success → clearDonationDraft() → router.replace(entryUrl)
//   refresh / new tab → module reloaded → null → redirect('/donation')

import type { CharityDetail, DonationDetail } from '@/lib/schemas/detail'

export type DonationDraft = {
  donationFrequency: 'ONE_TIME' | 'RECURRING'
  billingDay?: 'DAY_6' | 'DAY_16' | 'DAY_26'
  amountTwd: number
  target:
    | { type: 'CHARITY'; detail: CharityDetail }
    | { type: 'DONATION_PROJECT'; detail: DonationDetail }
}

let _draft: DonationDraft | null = null

export function setDonationDraft(d: DonationDraft): void {
  _draft = d
}

/** Read without clearing — Strict-Mode safe. */
export function peekDonationDraft(): DonationDraft | null {
  return _draft
}

export function clearDonationDraft(): void {
  _draft = null
}

/** Test reset helper. */
export function _resetDonationDraftForTest(): void {
  _draft = null
}

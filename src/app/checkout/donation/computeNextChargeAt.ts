// Spec 009a v0.4 §4.2 — Next-charge-date computation, mirroring
// backend 021 §7.7 (`computeNextChargeAt`). FE uses this purely for
// the confirm page's display row; the BE will run the same formula
// at order create time and the response's `nextChargeAt` becomes the
// source of truth once we wire to a real endpoint.
//
// Rule (verbatim from BE): UTC, strict less-than — if `todayUtcDate <
// day` the charge falls in this month, otherwise next month.

import type { BillingDay } from '../useDonationSettingsForm'

const BILLING_DAY_TO_INT: Record<BillingDay, 6 | 16 | 26> = {
  DAY_6: 6,
  DAY_16: 16,
  DAY_26: 26,
}

export function computeNextChargeAt(
  billingDay: BillingDay,
  now: Date = new Date(),
): Date {
  const day = BILLING_DAY_TO_INT[billingDay]
  const todayUtcDate = now.getUTCDate()
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + (todayUtcDate < day ? 0 : 1),
      day,
      0,
      0,
      0,
      0,
    ),
  )
}

/** yyyy/MM/dd via UTC fields (avoid timezone shift on display). */
export function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}/${String(d.getUTCDate()).padStart(2, '0')}`
}

import 'server-only'

// Spec 022 §4.1-4.3 — mock handlers for the three order-creation POST
// endpoints (USE_MOCK=1 path). They synthesise a PENDING order body that
// satisfies the minimum FE/BFF needs: `id` + `status`. Real backend
// returns the full OrderResponse (lines, inflated subjects, etc.) but
// the BFF route only plucks { orderId, status } from the response, so
// the mock stays light.
//
// v0.7 — `id` is now Zod-validated against `z.string().uuid()` at the
// BFF (route.ts §BeOrderResponse), so the mock must emit a real UUID v4.
// `crypto.randomUUID()` is available on Node ≥ 19 (Next 16 baseline).

import { randomUUID } from 'node:crypto'

import type { MockHandler } from './dispatch'

export const charityDonationHandler: MockHandler = () => ({
  id: randomUUID(),
  status: 'PENDING',
})

export const projectDonationHandler: MockHandler = () => ({
  id: randomUUID(),
  status: 'PENDING',
})

export const saleItemPurchaseHandler: MockHandler = () => ({
  id: randomUUID(),
  status: 'PENDING',
})

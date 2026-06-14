// Spec 004b / backend 017 §4 — Donation-project detail BFF.
// Upstream: GET /v1/donation/donation-projects/:id

import 'server-only'

import { createDetailRoute } from '@/lib/api/createDetailRoute'
import {
  BackendDonationDetail,
  toClientDonationDetail,
} from '@/lib/schemas/detail'

export const GET = createDetailRoute({
  upstream: '/v1/donation/donation-projects',
  backendSchema: BackendDonationDetail,
  toClient: toClientDonationDetail,
})

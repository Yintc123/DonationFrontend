// Spec 004a / backend 017 §3 — Charity detail BFF.
// Upstream: GET /v1/donation/charities/:id

import 'server-only'

import { createDetailRoute } from '@/lib/api/createDetailRoute'
import {
  BackendCharityDetail,
  toClientCharityDetail,
} from '@/lib/schemas/detail'

export const GET = createDetailRoute({
  upstream: '/v1/donation/charities',
  backendSchema: BackendCharityDetail,
  toClient: toClientCharityDetail,
})

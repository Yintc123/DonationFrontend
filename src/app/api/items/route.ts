// Spec 002 §2 / backend 016 §3 — public sale-item list BFF.
// Upstream: GET /v1/donation/sale-items

import 'server-only'

import { createListRoute } from '@/lib/api/createListRoute'
import {
  BackendItemListItem,
  toClientItem,
} from '@/lib/schemas/list'

export const GET = createListRoute({
  upstream: '/v1/donation/sale-items',
  backendItemSchema: BackendItemListItem,
  toClientItem: toClientItem,
})

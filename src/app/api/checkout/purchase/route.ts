// Spec 009 §5 (v0.4) — BFF route for sale-item purchase confirm submit.
//
// Body matches BE 022 §4.3 SaleItemPurchaseBody verbatim (ADR 012). The
// `_endpoint` discriminator is FE-side only and is stripped before
// forwarding (BE TypeBox uses additionalProperties: false).

import 'server-only'
import { z } from 'zod'

import { createRoute, okResponse } from '@/lib/api'
import { backendFetch } from '@/lib/api/backend'
import { ContractViolationError } from '@/lib/errors/ContractViolationError'

const Item = z.object({
  saleItemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
})

const Body = z.object({
  _endpoint: z.literal('/user/v1/donation/orders/sale-item-purchase'),
  donorName: z.string().min(1).max(120),
  // v0.7 — optional default false mirrors BE 022 §4.3 TypeBox
  // `Type.Optional(Type.Boolean())`.
  isAnonymous: z.boolean().optional().default(false),
  // BE 022 §4.3: items 必為長度 1（單品 UI，本期不支援 cart）
  items: z.array(Item).length(1),
})

type BodyShape = z.infer<typeof Body>

// v0.7 — Zod-validate BE 022 §4.3 response (same contract as 4.1/4.2).
const BeOrderResponse = z
  .object({
    id: z.string().uuid(),
    status: z.string().min(1),
  })
  .passthrough()

export const POST = createRoute({
  csrfExempt: true,
  bodySchema: Body,
  handler: async ({ body, requestId }) => {
    const { _endpoint, ...forwardBody } = body as BodyShape
    const { data } = await backendFetch<unknown>(_endpoint, {
      method: 'POST',
      body: forwardBody,
      requestId,
    })
    const parsed = BeOrderResponse.safeParse(data)
    if (!parsed.success) {
      throw new ContractViolationError(
        `Upstream ${_endpoint} response failed schema: ${parsed.error.message}`,
      )
    }
    return okResponse({ orderId: parsed.data.id, status: parsed.data.status })
  },
})

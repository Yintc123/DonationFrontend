// Spec 009 §5 (v0.4) — BFF route for donation confirm submit.
//
// Receives the FE payload built by useDonorInfoForm.buildPayload (ADR 012
// — already in BE 022 §4.1 / §4.2 body shape), routes to one of the two
// BE endpoints by the `_endpoint` discriminator, strips that discriminator
// before forwarding (BE TypeBox uses `additionalProperties: false`), and
// returns a minimal `{ orderId, status }` envelope to the FE.
//
// brief.md「不接金流」: BE stores the order with status PENDING. No mock-
// confirm-payment is called here — that's a separate step the spec leaves
// for a future "付款選擇頁".
//
// CSRF: csrfExempt=true, matching dev-login's anonymous-POST pattern. The
// BE endpoints themselves are unauthenticated (BE 022 §2.1), so there's
// no session cookie to defend.

import 'server-only'
import { z } from 'zod'

import { createRoute, okResponse } from '@/lib/api'
import { backendFetch } from '@/lib/api/backend'
import { ContractViolationError } from '@/lib/errors/ContractViolationError'

const RECEIPT_OPTION = z.enum([
  'NONE',
  'INDIVIDUAL',
  'CORPORATE',
  'GOVERNMENT_DONATION',
  'DEFER',
])

const DONATION_FREQUENCY = z.enum(['ONE_TIME', 'RECURRING'])
const BILLING_DAY = z.enum(['DAY_6', 'DAY_16', 'DAY_26'])

const BASE = {
  donorName: z.string().min(1).max(120),
  // v0.7 — optional default false mirrors BE 022 §4.1/§4.2 TypeBox
  // `Type.Optional(Type.Boolean())`. Form always sends a value today, but
  // the BFF schema is the contract with FE: future callers (e.g. a flow
  // without the anon checkbox) shouldn't be forced to send `false`.
  isAnonymous: z.boolean().optional().default(false),
  receiptOption: RECEIPT_OPTION,
  donationFrequency: DONATION_FREQUENCY,
  billingDay: BILLING_DAY.optional(),
  amountTwd: z.number().int().min(1).max(1_000_000),
}

const CharityDonationBody = z.object({
  _endpoint: z.literal('/user/v1/donation/orders/charity-donation'),
  ...BASE,
  charityId: z.string().uuid(),
})

const ProjectDonationBody = z.object({
  _endpoint: z.literal('/user/v1/donation/orders/project-donation'),
  ...BASE,
  donationProjectId: z.string().uuid(),
})

const Body = z
  .discriminatedUnion('_endpoint', [CharityDonationBody, ProjectDonationBody])
  .refine(
    (b) => b.donationFrequency === 'ONE_TIME' || b.billingDay !== undefined,
    { message: 'billingDay required when donationFrequency=RECURRING' },
  )
  .refine(
    (b) => b.donationFrequency !== 'ONE_TIME' || b.billingDay === undefined,
    { message: 'billingDay must be omitted when donationFrequency=ONE_TIME' },
  )

type BodyShape = z.infer<typeof Body>

// v0.7 — Zod-validate BE 022 §4.1 / §4.2 response. BE returns the full
// Order body; we only surface `{ orderId, status }` to FE, but validating
// the two fields we read prevents silent drift if BE renames `id` → `orderId`
// or wraps the body in another envelope. `.passthrough()` accepts all the
// other fields (donorName / lines / charity / nextChargeAt / ...) without
// us having to mirror BE's full Order schema here.
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
    // Strip FE-side discriminator before forwarding — BE 022 TypeBox uses
    // `additionalProperties: false`, leaving _endpoint in would 400.
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

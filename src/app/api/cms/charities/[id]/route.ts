// Spec 011a §6.3 — admin charity detail (GET) + edit (PATCH) BFF.

import 'server-only'

import { backendFetch } from '@/lib/api/backend'
import { createAdminRoute } from '@/lib/api/createAdminRoute'
import { okResponse } from '@/lib/api/responses'
import { ContractViolationError } from '@/lib/errors/ContractViolationError'
import { BackendAdminCharityDetail } from '@/lib/schemas/admin-detail'

import { CharityIdParams, CharityPatchBody } from '../schemas'

export const GET = createAdminRoute({
  paramsSchema: CharityIdParams,
  handler: async ({ params, requestId }) => {
    const { data } = await backendFetch<unknown>(
      `/cms/donation/charities/${params.id}`,
      { requestId },
    )
    const parsed = BackendAdminCharityDetail.safeParse(data)
    if (!parsed.success) {
      throw new ContractViolationError(
        `Upstream GET /cms/donation/charities/${params.id} response failed schema: ${parsed.error.message}`,
      )
    }
    return okResponse(parsed.data)
  },
})

export const PATCH = createAdminRoute({
  paramsSchema: CharityIdParams,
  bodySchema: CharityPatchBody,
  handler: async ({ params, body, requestId }) => {
    // BE 020 §5.1.2 PATCH returns the public CharityDetail shape (without
    // admin lifecycle metadata). FE doesn't read it on success — submit
    // handler discards body and router.replace('/cms/charities') — so
    // pass through verbatim without Zod gating to avoid spurious 502s
    // when the read endpoint extends. The read path uses GET admin detail
    // for the next render anyway.
    const { data } = await backendFetch<unknown>(
      `/cms/donation/charities/${params.id}`,
      { method: 'PATCH', body, requestId },
    )
    return okResponse(data)
  },
})

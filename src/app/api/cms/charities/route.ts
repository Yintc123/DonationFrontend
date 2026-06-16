// Spec 011a §6.2 — admin charity list + create BFF.

import 'server-only'

import { backendFetch } from '@/lib/api/backend'
import { createAdminRoute } from '@/lib/api/createAdminRoute'
import { okResponse } from '@/lib/api/responses'
import { ContractViolationError } from '@/lib/errors/ContractViolationError'
import { BackendAdminCharityDetail } from '@/lib/schemas/admin-detail'

import { CharityCreateBody } from './schemas'

export const POST = createAdminRoute({
  bodySchema: CharityCreateBody,
  handler: async ({ body, requestId }) => {
    const { data } = await backendFetch<unknown>(
      '/cms/donation/charities',
      { method: 'POST', body, requestId },
    )
    const parsed = BackendAdminCharityDetail.safeParse(data)
    if (!parsed.success) {
      throw new ContractViolationError(
        `Upstream POST /cms/donation/charities response failed schema: ${parsed.error.message}`,
      )
    }
    return okResponse(parsed.data)
  },
})

// Spec 011a §6.2 + BE 026 §5.1.1 — admin list. Forwards to BE admin
// endpoint which caps limit at 100; bypasses Redis cache (BE 026 §2.4).
export const GET = createAdminRoute({
  handler: async ({ req, requestId }) => {
    const url = new URL(req.url)
    const requested = Number(url.searchParams.get('limit') ?? '100')
    const limit = Math.min(Math.max(1, requested || 100), 100)
    const qs = new URLSearchParams({ limit: String(limit) })
    // Optional admin filters (BE 026 §5.1.1): includeArchived / includeDeleted
    for (const k of ['includeArchived', 'includeDeleted'] as const) {
      const v = url.searchParams.get(k)
      if (v !== null) qs.set(k, v)
    }
    const { data } = await backendFetch<unknown>(
      `/cms/donation/charities?${qs.toString()}`,
      { requestId },
    )
    return okResponse(data)
  },
})

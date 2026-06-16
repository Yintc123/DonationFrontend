import 'server-only'
import type { ZodType } from 'zod'

import { createRoute } from './create-route'
import { ForbiddenError } from '@/lib/errors'
import { Role, type StoredSession } from '@/lib/session/types'

type AdminHandlerArgs<TBody, TQuery, TParams> = {
  req: Request
  requestId: string
  body: TBody
  query: TQuery
  params: TParams
  session: StoredSession
}

type AdminRouteOptions<TBody, TQuery, TParams> = {
  bodySchema?: ZodType<TBody>
  querySchema?: ZodType<TQuery>
  paramsSchema?: ZodType<TParams>
  handler: (
    args: AdminHandlerArgs<TBody, TQuery, TParams>,
  ) => Promise<Response> | Response
}

/**
 * Spec 011 §3.6 — BFF admin route wrapper.
 *
 * Layers on top of `createRoute`:
 *  - `requireAuth: true` → no session → 401 UNAUTHENTICATED
 *  - Role check after auth → non-admin → 403 FORBIDDEN
 *  - CSRF stays automatic (createRoute verifies on non-safe methods);
 *    do not set csrfExempt on admin routes
 */
export function createAdminRoute<
  TBody = undefined,
  TQuery = undefined,
  TParams = undefined,
>(opts: AdminRouteOptions<TBody, TQuery, TParams>) {
  return createRoute<TBody, TQuery, TParams, true>({
    requireAuth: true,
    bodySchema: opts.bodySchema,
    querySchema: opts.querySchema,
    paramsSchema: opts.paramsSchema,
    handler: async (args) => {
      if (args.session.role !== Role.ADMIN) {
        throw new ForbiddenError('admin role required')
      }
      return opts.handler({ ...args, session: args.session })
    },
  })
}

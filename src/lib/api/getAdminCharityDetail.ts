// Spec 011a §5.1 — RSC helper for admin charity detail.
//
// Hits BE 026 GET /cms/donation/charities/:id (not the public /user/v1
// detail) so the response includes displayOrder + publishStartAt/End +
// archivedAt + deletedAt — fields the edit form needs to pre-fill and
// the public schema strips. NotFoundError propagates so the calling RSC
// can pair it with notFound().

import 'server-only'

import { headers } from 'next/headers'

import { ContractViolationError } from '@/lib/errors/ContractViolationError'
import {
  BackendAdminCharityDetail,
  type BackendAdminCharityDetail as AdminCharityDetail,
} from '@/lib/schemas/admin-detail'

import { backendFetch } from './backend'

async function languageHeader(): Promise<Record<string, string> | undefined> {
  const h = await headers()
  const lang = h.get('accept-language')
  return lang ? { 'accept-language': lang } : undefined
}

export async function fetchAdminCharityDetail(
  id: string,
): Promise<AdminCharityDetail> {
  const { data } = await backendFetch<unknown>(
    `/cms/donation/charities/${id}`,
    { headers: await languageHeader() },
  )
  const parsed = BackendAdminCharityDetail.safeParse(data)
  if (!parsed.success) {
    throw new ContractViolationError(
      `Admin charity detail schema mismatch: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

// Spec 011 §5.5 — RSC helper for category dictionary.
//
// Used by admin CMS create/edit forms (and any future RSC that needs
// the categoryIds candidate list). Mirrors fetchCharityDetail's pattern:
// backendFetch + Zod validation + ContractViolationError on drift.

import 'server-only'
import { headers } from 'next/headers'

import { ContractViolationError } from '@/lib/errors/ContractViolationError'
import {
  BackendCategoryListResponse,
  type BackendCategoryItem,
} from '@/lib/schemas/categories'

import { backendFetch } from './backend'

async function languageHeader(): Promise<Record<string, string> | undefined> {
  const h = await headers()
  const lang = h.get('accept-language')
  return lang ? { 'accept-language': lang } : undefined
}

export async function fetchCategories(): Promise<BackendCategoryItem[]> {
  const { data } = await backendFetch<unknown>(
    '/user/v1/donation/categories',
    { headers: await languageHeader() },
  )
  const parsed = BackendCategoryListResponse.safeParse(data)
  if (!parsed.success) {
    throw new ContractViolationError(
      `Categories response schema mismatch: ${parsed.error.message}`,
    )
  }
  return parsed.data.items
}

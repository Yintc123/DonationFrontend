// Spec 011 §5.4 — admin variants of charity / project / item.
//
// BE 026 admin GET endpoints return the public detail shape (spec 017)
// plus admin lifecycle metadata. Mirror exactly so edit forms can
// pre-fill displayOrder / publishStartAt / publishEndAt — the public
// schemas in detail.ts intentionally omit these.

import { z } from 'zod'
import { InflatedCategory } from './detail'

const NullableIsoDate = z.string().nullable()

const AdminLifecycle = z.object({
  displayOrder: z.number().int(),
  publishStartAt: NullableIsoDate,
  publishEndAt: NullableIsoDate,
  archivedAt: NullableIsoDate,
  deletedAt: NullableIsoDate,
})

export const BackendAdminCharityDetail = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  logoUrl: z.string().url().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  officialWebsite: z.string().nullable(),
  approvalNo: z.string().nullable(),
  categories: z.array(InflatedCategory),
  createdAt: z.string(),
  updatedAt: z.string(),
}).merge(AdminLifecycle)

export type BackendAdminCharityDetail = z.infer<typeof BackendAdminCharityDetail>

// BE 026 admin list item: standalone shape (omits createdAt/updatedAt
// per spec §5.1.1), so don't .merge() with BackendCharityListItem.
export const BackendAdminCharityListItem = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  logoUrl: z.string().url().nullable(),
  categories: z.array(InflatedCategory),
}).merge(AdminLifecycle)

export type BackendAdminCharityListItem = z.infer<typeof BackendAdminCharityListItem>

export const BackendAdminCharityListResponse = z.object({
  items: z.array(BackendAdminCharityListItem),
  nextCursor: z.string().nullable().optional(),
})

export type BackendAdminCharityListResponse = z.infer<typeof BackendAdminCharityListResponse>

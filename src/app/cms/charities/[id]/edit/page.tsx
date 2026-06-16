// Spec 011a §5 — /cms/charities/[id]/edit
//
// RSC fetches the admin charity detail (BE 026 §5.1.2) plus the category
// dictionary, hydrates the reducer's initial state, and hands off to the
// shared CharityForm client component. 404 on missing id falls through
// to Next's notFound() so the global not-found page handles it.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { fetchAdminCharityDetail } from '@/lib/api/getAdminCharityDetail'
import { fetchCategories } from '@/lib/api/getCategories'
import { NotFoundError } from '@/lib/errors/NotFoundError'
import { requireAdminSession } from '@/lib/session/requireAdmin'

import { CharityForm } from '../../CharityForm'
import { DEFAULT_FORM, type FormState } from '../../useCharityForm'

export const metadata: Metadata = {
  title: '編輯公益團體 | JKODonation',
}

export default async function CharityEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminSession()
  const { id } = await params

  let charity
  try {
    charity = await fetchAdminCharityDetail(id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  const categories = await fetchCategories()

  const initial: FormState = {
    ...DEFAULT_FORM,
    name: charity.name,
    description: charity.description,
    contactPhone: charity.contactPhone ?? '',
    contactEmail: charity.contactEmail ?? '',
    officialWebsite: charity.officialWebsite ?? '',
    approvalNo: charity.approvalNo ?? '',
    displayOrder: charity.displayOrder,
    publishStartAt: charity.publishStartAt ?? '',
    publishEndAt: charity.publishEndAt ?? '',
    categoryIds: charity.categories.map((c) => c.id),
  }

  return (
    <CharityForm
      mode="edit"
      id={id}
      initial={initial}
      categories={categories}
    />
  )
}

// Spec 009a v0.4 — /checkout/donation confirm page (RSC).
//
// 1. Parse URL query with a Zod schema whose enum values mirror BE 022 §4
//    Prisma enums verbatim. Fail → notFound() (don't leak schema errors to
//    the user).
// 2. fetch target detail by targetType (charity vs project) — RSC fetcher
//    `fetchCharityDetail` / `fetchDonationDetail` throws NotFoundError
//    which we map to Next 404 as well.
// 3. Hand the parsed query + target to the client component for form
//    state + submit handling.

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { z } from 'zod'
import {
  fetchCharityDetail,
  fetchDonationDetail,
} from '@/lib/api/getDetail'
import { NotFoundError } from '@/lib/errors/NotFoundError'
import { DonationConfirmPage } from './DonationConfirmPage'

export const metadata: Metadata = {
  title: '確認捐款資訊 | JKODonation',
}

const Query = z
  .object({
    targetType: z.enum(['CHARITY', 'DONATION_PROJECT']),
    targetId: z.string().uuid(),
    donationFrequency: z.enum(['ONE_TIME', 'RECURRING']),
    billingDay: z.enum(['DAY_6', 'DAY_16', 'DAY_26']).optional(),
    amountTwd: z.coerce.number().int().min(1).max(1_000_000),
  })
  .refine(
    (q) => q.donationFrequency === 'ONE_TIME' || q.billingDay !== undefined,
    { message: 'billingDay required when donationFrequency=RECURRING' },
  )
  .refine(
    (q) => q.donationFrequency !== 'ONE_TIME' || q.billingDay === undefined,
    { message: 'billingDay must be omitted when donationFrequency=ONE_TIME' },
  )

type SearchParams = Record<string, string | string[] | undefined>

async function fetchTarget(query: z.infer<typeof Query>) {
  try {
    return query.targetType === 'CHARITY'
      ? await fetchCharityDetail(query.targetId)
      : await fetchDonationDetail(query.targetId)
  } catch (e) {
    if (e instanceof NotFoundError) return null
    throw e
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const parsed = Query.safeParse(sp)
  if (!parsed.success) notFound()
  const query = parsed.data
  const target = await fetchTarget(query)
  if (!target) notFound()
  return <DonationConfirmPage query={query} target={target} />
}

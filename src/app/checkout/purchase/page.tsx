// Spec 009b v0.4 — /checkout/purchase confirm page (RSC).

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { z } from 'zod'
import { fetchItemDetail } from '@/lib/api/getDetail'
import { NotFoundError } from '@/lib/errors/NotFoundError'
import { PurchaseConfirmPage } from './PurchaseConfirmPage'

export const metadata: Metadata = {
  title: '確認捐款資訊 | JKODonation',
}

const Query = z.object({
  saleItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(100),
})

type SearchParams = Record<string, string | string[] | undefined>

async function fetchItem(id: string) {
  try {
    return await fetchItemDetail(id)
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
  const item = await fetchItem(parsed.data.saleItemId)
  if (!item) notFound()
  return <PurchaseConfirmPage query={parsed.data} item={item} />
}

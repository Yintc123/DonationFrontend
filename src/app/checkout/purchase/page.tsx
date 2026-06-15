// Spec 009b v0.7 — /checkout/purchase RSC shell.
// Same pattern as donation/page.tsx — metadata + client entry. The form
// payload flows through the in-memory draft store (./draft-store), not
// the URL query string.

import type { Metadata } from 'next'
import { PurchaseConfirmPageEntry } from './PurchaseConfirmPageEntry'

export const metadata: Metadata = {
  title: '確認捐款資訊 | JKODonation',
}

export default function Page() {
  return <PurchaseConfirmPageEntry />
}

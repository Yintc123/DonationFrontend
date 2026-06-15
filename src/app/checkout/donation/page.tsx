// Spec 009a v0.7 — /checkout/donation RSC shell.
//
// Used to parse URL query + RSC-fetch the target by id. v0.7 removed both:
// the form draft (including target detail) now flows through an in-memory
// module store (./draft-store) populated by the sheet. This RSC just owns
// metadata and hands control to the client entry, which peeks the store
// and redirects to /donation when empty.

import type { Metadata } from 'next'
import { DonationConfirmPageEntry } from './DonationConfirmPageEntry'

export const metadata: Metadata = {
  title: '確認捐款資訊 | JKODonation',
}

export default function Page() {
  return <DonationConfirmPageEntry />
}

'use client'

// Spec 009b v0.7 — client entry that reads the in-memory purchase draft.
// Same shape as DonationConfirmPageEntry; see that file's header for the
// peek-not-take rationale.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { peekPurchaseDraft, type PurchaseDraft } from './draft-store'
import { PurchaseConfirmPage } from './PurchaseConfirmPage'

type State = 'pending' | PurchaseDraft | null

export function PurchaseConfirmPageEntry() {
  const router = useRouter()
  const [state, setState] = useState<State>('pending')

  useEffect(() => {
    // setState here mirrors the external draft store — bridging external
    // state into React is the intended use of setState-in-effect.
    const d = peekPurchaseDraft()
    if (!d) {
      router.replace('/donation')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(null)
      return
    }
    setState(d)
  }, [router])

  if (state === 'pending' || state === null) return null
  return <PurchaseConfirmPage draft={state} />
}

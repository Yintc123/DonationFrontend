'use client'

// Spec 009a v0.7 — client entry that reads the in-memory donation draft.
// Sits between the RSC shell (page.tsx — exports metadata) and the actual
// confirm UI (DonationConfirmPage). Its only job:
//   - peek the draft on mount
//   - if null (direct visit, refresh, or after a successful submit
//     cleared it) → router.replace('/donation')
//   - if present → render DonationConfirmPage with the draft
//
// peek (not take) is intentional: React 19 Strict Mode runs the effect
// twice in dev, and a read-and-clear would empty the slot on the second
// pass and bounce a valid session away. Explicit clearDonationDraft()
// happens in useDonorInfoForm.handleSubmit on success instead.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { peekDonationDraft, type DonationDraft } from './draft-store'
import { DonationConfirmPage } from './DonationConfirmPage'

// 'pending' = effect hasn't run yet; null = no draft (will redirect).
type State = 'pending' | DonationDraft | null

export function DonationConfirmPageEntry() {
  const router = useRouter()
  const [state, setState] = useState<State>('pending')

  useEffect(() => {
    // setState here mirrors the external draft store — bridging external
    // state into React is the intended use of setState-in-effect.
    const d = peekDonationDraft()
    if (!d) {
      router.replace('/donation')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(null)
      return
    }
    setState(d)
  }, [router])

  // 'pending' (first paint pre-effect) and null (redirect en route) both
  // render nothing — avoids flashing the confirm UI with stale or absent data.
  if (state === 'pending' || state === null) return null
  return <DonationConfirmPage draft={state} />
}

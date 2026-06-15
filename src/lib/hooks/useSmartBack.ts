'use client'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { useHasInAppNavigated } from './useInAppNav'

/**
 * Spec 005 §4 — smart back navigation.
 *
 * If the user has navigated inside the app at least once this session
 * (tracked by `<InAppNavProvider>` via pathname diffs), uses
 * `router.back()` to honour the browser history stack. Otherwise — i.e.
 * the current page is the FIRST page in this tab (typed URL, bookmark,
 * external referrer, refresh) — pushes to `fallback` so the back button
 * is never inert.
 *
 * Default fallback `/` matches spec 005's "回首頁" requirement. Pages
 * with a more sensible fallback (e.g. detail → list) can pass their own.
 */
export function useSmartBack(fallback: string = '/'): () => void {
  const router = useRouter()
  const hasNavigated = useHasInAppNavigated()
  return useCallback(
    () => (hasNavigated ? router.back() : router.push(fallback)),
    [hasNavigated, router, fallback],
  )
}

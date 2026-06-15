import { toast } from 'sonner'

import { getHttpStatus } from './HttpClientError'

/**
 * Spec 006 — global TanStack-Query error handler.
 *
 * Wired into `QueryClient` via `QueryCache` / `MutationCache` `onError`.
 * Only 5xx triggers a toast; everything else is left for the per-section
 * `<InlineError>` retry UX (spec 003h). Toast id is a fixed string so
 * sonner upserts instead of stacking when one user action fans out into
 * multiple concurrent requests — user sees one "server 維修中" banner,
 * not five.
 */
export const SERVER_5XX_TOAST_ID = 'server-5xx'
export const SERVER_5XX_TOAST_DURATION_MS = 3000
const SERVER_5XX_MESSAGE = 'server 目前維修中…'

export function handleGlobalQueryError(error: unknown): void {
  const status = getHttpStatus(error)
  if (status !== null && status >= 500) {
    toast.error(SERVER_5XX_MESSAGE, {
      id: SERVER_5XX_TOAST_ID,
      duration: SERVER_5XX_TOAST_DURATION_MS,
    })
  }
}

/** Call from QueryCache `onSuccess` so a recovering server clears the banner. */
export function handleGlobalQuerySuccess(): void {
  toast.dismiss(SERVER_5XX_TOAST_ID)
}

/**
 * Spec 006 — client-side HTTP error.
 *
 * Thrown by client fetchers (e.g. `useResourceListInfinite`) when the BFF
 * returns a non-2xx HTTP response. Carries `.status` so the TanStack
 * Query global error handler can decide whether to toast (5xx) or stay
 * silent (let the per-section `<InlineError>` take it, 4xx).
 *
 * Server-side errors thrown inside BFF route handlers use the existing
 * `BffError` hierarchy and never reach this class.
 */
export class HttpClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpClientError'
  }
}

/**
 * Best-effort HTTP status extraction for the global error handler.
 * Returns null for unknown shapes so callers can opt out of toasting.
 */
export function getHttpStatus(error: unknown): number | null {
  if (error instanceof HttpClientError) return error.status
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status
  }
  return null
}

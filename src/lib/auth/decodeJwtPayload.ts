// Spec 011 §3.4 — read claims out of an access JWT we just got from BE.
//
// BE /auth/me does NOT return `role` (it's a JWT-only claim per spec
// 007 §10.10), so the /auth/login / /auth/register / OAuth callback
// BFF routes must decode the access token to know whether the session
// belongs to an admin. We don't verify the signature — the token came
// from BE through a trusted fetch — we just split on '.' and
// base64url-decode the middle slice.

const PADDING = '='

function base64UrlToBase64(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = (4 - (b64.length % 4)) % 4
  return b64 + PADDING.repeat(pad)
}

export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const json = Buffer.from(base64UrlToBase64(parts[1]), 'base64').toString(
      'utf-8',
    )
    const parsed = JSON.parse(json) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

// USE_MOCK=1 stand-ins for the BE auth bridge that `/api/auth/login` and
// `/api/auth/register` invoke. We don't run a real backend in mock mode,
// so without these handlers the login e2e smoke 502s the moment it hits
// `backendFetch('/auth/login')`.
//
// /auth/login returns a token bundle shaped to BackendRegisterResponse
// (Spec 007 §5.4) with a parseable JWT carrying `role: 0` (ADMIN) so
// resolveRole() in the BFF login route decodes the right admin session.
//
// /auth/me mirrors BE 008 §6.4 — note `role` is intentionally absent;
// the BFF login route relies on the JWT claim, and tests for the
// JWT-only fallback would silently regress if we leaked role here.

import 'server-only'

import { Role } from '@/lib/session/types'
import type { MockHandler } from './dispatch'

const MOCK_ADMIN_ID = '00000000-0000-4000-8000-0000000000ad'

function base64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function makeJwt(payload: Record<string, unknown>): string {
  return `${base64Url({ alg: 'HS256' })}.${base64Url(payload)}.sig`
}

export const loginHandler: MockHandler = () => ({
  accessToken: makeJwt({ sub: MOCK_ADMIN_ID, type: 'access', role: Role.ADMIN }),
  refreshToken: makeJwt({ sub: MOCK_ADMIN_ID, type: 'refresh' }),
  accessExpiresIn: 3 * 60 * 60,
  refreshExpiresIn: 30 * 24 * 60 * 60,
  tokenType: 'Bearer',
})

export const meHandler: MockHandler = () => ({
  id: MOCK_ADMIN_ID,
  username: 'admin',
  email: null,
  createdAt: '2026-06-16T00:00:00.000Z',
  updatedAt: '2026-06-16T00:00:00.000Z',
})

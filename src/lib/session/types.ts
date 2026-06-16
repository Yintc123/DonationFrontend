import 'server-only'

// Spec 011 §3.2 — admin role embedding into session.
// Mirrors backend Role enum (BE 020 §2.3 `Role.ADMIN = 0` / `USER = 1`).
// Sessions written before this field existed will read back as
// `role: undefined`; admin checks compare with `=== Role.ADMIN`, so
// undefined fails closed (treated as non-admin). Production rollout
// clears Redis sessions namespace; demo has no live users to disrupt.
export const Role = { ADMIN: 0, USER: 1 } as const
export type RoleValue = (typeof Role)[keyof typeof Role]

export type StoredSession = {
  userId: string
  accessToken: string
  accessTokenExpiresAt: number
  refreshToken: string
  refreshTokenExpiresAt: number
  user: { id: string; name: string }
  role: RoleValue
  csrfToken: string
  createdAt: number
}

export type TokenPair = {
  accessToken: string
  accessTokenExpiresAt: number
  refreshToken: string
  refreshTokenExpiresAt: number
}

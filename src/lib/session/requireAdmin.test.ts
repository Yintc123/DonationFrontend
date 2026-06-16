import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Role, type StoredSession } from './types'

const getMock = vi.fn<() => Promise<StoredSession | null>>()
vi.mock('./service', () => ({
  getSessionService: () => ({ get: getMock }),
}))

const redirectMock = vi.fn((path: string): never => {
  throw new Error(`REDIRECT:${path}`)
})
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

import { requireAdminSession } from './requireAdmin'

beforeEach(() => {
  getMock.mockReset()
  redirectMock.mockClear()
})

function adminSession(): StoredSession {
  const now = Date.now()
  return {
    userId: 'u1',
    accessToken: 'at',
    accessTokenExpiresAt: now + 60_000,
    refreshToken: 'rt',
    refreshTokenExpiresAt: now + 600_000,
    user: { id: 'u1', name: 'Alice' },
    role: Role.ADMIN,
    csrfToken: 'c'.repeat(43),
    createdAt: now,
  }
}

describe('requireAdminSession', () => {
  it('session=null → redirect /?reason=cms-not-admin', async () => {
    getMock.mockResolvedValue(null)
    await expect(requireAdminSession()).rejects.toThrow(/REDIRECT/)
    expect(redirectMock).toHaveBeenCalledWith('/?reason=cms-not-admin')
  })

  it('session non-admin → redirect /?reason=cms-not-admin', async () => {
    getMock.mockResolvedValue({ ...adminSession(), role: Role.USER })
    await expect(requireAdminSession()).rejects.toThrow(/REDIRECT/)
    expect(redirectMock).toHaveBeenCalledWith('/?reason=cms-not-admin')
  })

  it('session admin → return session、no redirect', async () => {
    const s = adminSession()
    getMock.mockResolvedValue(s)
    await expect(requireAdminSession()).resolves.toBe(s)
    expect(redirectMock).not.toHaveBeenCalled()
  })
})

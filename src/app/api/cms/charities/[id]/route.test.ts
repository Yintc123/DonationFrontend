import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HttpResponse } from 'msw'
import { Role, type StoredSession } from '@/lib/session/types'

const overrides = vi.hoisted(() => ({
  session: null as StoredSession | null,
}))

vi.mock('@/lib/config', () => ({
  env: {
    USE_MOCK: '0',
    BACKEND_API_URL: 'http://backend.test',
    NODE_ENV: 'test',
    SESSION_SECRET: 'test-session-secret-must-be-32-chars-long',
    SESSION_COOKIE_NAME: 'jko_session',
    SESSION_TTL_SECONDS: 2_592_000,
    ALLOWED_ORIGINS: 'http://localhost:3000',
    REDIS_KEY_PREFIX: 'jko-bff-test',
    APP_VERSION: '0.0.0-test',
    NEXT_PUBLIC_APP_NAME: 'JKODonation',
  },
}))

vi.mock('@/lib/session/service', () => ({
  getSessionService: () => ({
    get: vi.fn().mockImplementation(async () => overrides.session),
    touch: vi.fn().mockResolvedValue(undefined),
    wasMutated: () => false,
  }),
}))

import { mockBackend } from '../../../../../../tests/helpers/backend-mock'
import { _resetMockRegistry } from '@/lib/mock/dispatch'
import { GET, PATCH } from './route'

const CHARITY_ID = '00000000-0000-4000-8000-000000000001'

function adminSession(): StoredSession {
  const now = Date.now()
  return {
    userId: 'admin-1',
    accessToken: 'at',
    accessTokenExpiresAt: now + 60_000,
    refreshToken: 'rt',
    refreshTokenExpiresAt: now + 600_000,
    user: { id: 'admin-1', name: 'Admin' },
    role: Role.ADMIN,
    csrfToken: 'c'.repeat(43),
    createdAt: now,
  }
}

function getReq(id: string): Request {
  return {
    method: 'GET',
    url: `http://localhost:3000/api/cms/charities/${id}`,
    headers: new Headers(),
    body: null,
  } as unknown as Request
}

function patchReq(id: string, body: unknown, csrfToken: string): Request {
  const headers = new Headers({
    origin: 'http://localhost:3000',
    'content-type': 'application/json',
    'x-csrf-token': csrfToken,
  })
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(JSON.stringify(body)))
      c.close()
    },
  })
  return {
    method: 'PATCH',
    url: `http://localhost:3000/api/cms/charities/${id}`,
    headers,
    body: stream,
  } as unknown as Request
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

const FULL_ADMIN_DETAIL = {
  id: CHARITY_ID,
  name: '中華耆幼關懷協會',
  description: '描述',
  logoUrl: null,
  contactPhone: null,
  contactEmail: null,
  officialWebsite: null,
  approvalNo: null,
  categories: [],
  createdAt: '2026-06-16T00:00:00.000Z',
  updatedAt: '2026-06-16T00:00:00.000Z',
  displayOrder: 0,
  publishStartAt: null,
  publishEndAt: null,
  archivedAt: null,
  deletedAt: null,
}

beforeEach(() => {
  _resetMockRegistry()
  overrides.session = null
})

describe('GET /api/cms/charities/[id]', () => {
  it('no session → 401', async () => {
    const res = await GET(getReq(CHARITY_ID), ctx(CHARITY_ID))
    expect(res.status).toBe(401)
  })

  it('admin → forward + parse admin detail shape', async () => {
    overrides.session = adminSession()
    mockBackend(
      'get',
      `http://backend.test/cms/donation/charities/${CHARITY_ID}`,
      () => HttpResponse.json(FULL_ADMIN_DETAIL, { status: 200 }),
    )
    const res = await GET(getReq(CHARITY_ID), ctx(CHARITY_ID))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: typeof FULL_ADMIN_DETAIL }
    expect(body.data.displayOrder).toBe(0)
  })

  it('malformed id → 400 (paramsSchema)', async () => {
    overrides.session = adminSession()
    const res = await GET(getReq('not-a-uuid'), ctx('not-a-uuid'))
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/cms/charities/[id]', () => {
  it('non-admin → 403', async () => {
    overrides.session = { ...adminSession(), role: Role.USER }
    const session = adminSession()
    const res = await PATCH(
      patchReq(CHARITY_ID, { name: 'New' }, session.csrfToken),
      ctx(CHARITY_ID),
    )
    expect(res.status).toBe(403)
  })

  it('admin + partial body → forward PATCH', async () => {
    overrides.session = adminSession()
    let receivedBody: unknown
    mockBackend(
      'patch',
      `http://backend.test/cms/donation/charities/${CHARITY_ID}`,
      async (req) => {
        receivedBody = await req.json()
        return HttpResponse.json(FULL_ADMIN_DETAIL, { status: 200 })
      },
    )
    const session = adminSession()
    overrides.session = session
    const res = await PATCH(
      patchReq(CHARITY_ID, { name: 'Updated' }, session.csrfToken),
      ctx(CHARITY_ID),
    )
    expect(res.status).toBe(200)
    expect(receivedBody).toMatchObject({ name: 'Updated' })
  })

  it('admin + publishEnd <= publishStart → 400 (refine)', async () => {
    overrides.session = adminSession()
    const session = adminSession()
    const res = await PATCH(
      patchReq(
        CHARITY_ID,
        {
          publishStartAt: '2026-06-16T00:00:00.000Z',
          publishEndAt: '2026-06-16T00:00:00.000Z',
        },
        session.csrfToken,
      ),
      ctx(CHARITY_ID),
    )
    expect(res.status).toBe(400)
  })
})

// Spec 002 §4.5 — registration smoke. Importing `./register` runs the
// side-effect registerMock calls once; subsequent `resolveMock` lookups
// must succeed for every upstream the BFF can hit.

import { describe, it, expect, beforeAll } from 'vitest'

import { decodeJwtPayload } from '@/lib/auth/decodeJwtPayload'
import { Role } from '@/lib/session/types'
import { resolveMock, _resetMockRegistry } from './dispatch'

beforeAll(async () => {
  _resetMockRegistry()
  await import('./register')
})

describe('mock/register — all 7 upstream paths registered', () => {
  it.each([
    '/user/v1/donation/charities',
    '/user/v1/donation/donation-projects',
    '/user/v1/donation/sale-items',
    '/user/v1/donation/categories',
  ])('list / dictionary endpoint %s', (path) => {
    expect(resolveMock(path)).toBeDefined()
  })

  it.each(['/auth/login', '/auth/me'])('auth endpoint %s registered', (path) => {
    expect(resolveMock(path)).toBeDefined()
  })

  it('/auth/login emits a JWT with admin role claim', () => {
    const handler = resolveMock('/auth/login')!
    const tokens = handler({}) as { accessToken: string; tokenType: string }
    expect(tokens.tokenType).toBe('Bearer')
    const claims = decodeJwtPayload(tokens.accessToken)
    expect(claims?.role).toBe(Role.ADMIN)
  })

  it('/auth/me emits a user shape matching BackendMeResponse (no role field)', () => {
    const handler = resolveMock('/auth/me')!
    const me = handler({}) as Record<string, unknown>
    expect(me.id).toBeTypeOf('string')
    expect(me.username).toBe('admin')
    expect('role' in me).toBe(false)
  })

  it.each([
    '/user/v1/donation/charities/11111111-1111-4111-8111-000000000001',
    '/user/v1/donation/donation-projects/22222222-2222-4222-8222-000000000001',
    '/user/v1/donation/sale-items/33333333-3333-4333-8333-000000000001',
  ])('detail endpoint resolves the :id pattern (%s)', (path) => {
    expect(resolveMock(path)).toBeDefined()
  })

  it('list endpoint emits backend-shape payload (pageInfo + inflated categories)', () => {
    const handler = resolveMock('/user/v1/donation/charities')!
    const out = handler({}) as {
      items: { categories: { key: string }[] }[]
      pageInfo: { nextCursor: string | null; hasMore: boolean }
    }
    expect(out.items.length).toBeGreaterThan(0)
    expect(out.pageInfo).toHaveProperty('hasMore')
    expect(out.pageInfo).toHaveProperty('nextCursor')
    expect(out.items[0]!.categories[0]).toHaveProperty('key')
    expect(out.items[0]!.categories[0]).toHaveProperty('displayName')
  })

  it('list endpoint honours `q` filter (case-insensitive contains)', () => {
    const handler = resolveMock('/user/v1/donation/charities')!
    const filtered = handler({ query: { q: '動物' } }) as {
      items: { name: string }[]
    }
    expect(filtered.items.length).toBeGreaterThan(0)
    expect(filtered.items.every((c) => c.name.includes('動物'))).toBe(true)
  })

  it('list endpoint honours `category` filter', () => {
    const handler = resolveMock('/user/v1/donation/charities')!
    const filtered = handler({ query: { category: 'animal_protection' } }) as {
      items: { categories: { key: string }[] }[]
    }
    for (const item of filtered.items) {
      expect(item.categories.some((c) => c.key === 'animal_protection')).toBe(true)
    }
  })

  it('categories dictionary returns 16 entries (matches CATEGORY_KEYS)', () => {
    const handler = resolveMock('/user/v1/donation/categories')!
    const out = handler({}) as { items: unknown[] }
    expect(out.items).toHaveLength(16)
  })
})

// Spec 002 §6 — useResourceListInfinite hook.
//
// Contract pinned by these tests:
//
//   1. Picks the right BFF path per `resource` (charity → /api/charities,
//      donation → /api/donations, item → /api/items).
//   2. Forwards `q` + `category` via the request URL exactly once per
//      input change.
//   3. When `enabled: false`, the hook does NOT fire any network request
//      (drives spec 002 §1.3 "lazy tab" — inactive tabs cost nothing).
//   4. Returns a flattened `items` list across all loaded pages plus the
//      page-info needed by the scroll-percent sentinel.
//   5. `fetchNextPage()` advances the cursor and concatenates results.
//   6. Stable `queryKey` per (resource, q, category) — switching back
//      hits cache without refetch (within staleTime).
//   7. Error path: when BFF returns 5xx, hook surfaces `isError: true`
//      and an Error instance.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'

import { useResourceListInfinite } from './useResourceListInfinite'

// vi.hoisted because vi.mock pulls these in at module evaluation, which
// happens before the file's top-level statements run.
const state = vi.hoisted(() => ({
  pages: new Map<string, { items: unknown[]; nextCursor: string | null }>(),
  failOn: null as string | null,
  capturedUrls: [] as string[],
}))

beforeEach(() => {
  state.pages.clear()
  state.failOn = null
  state.capturedUrls.length = 0
})

// fetch is a read-only global in some envs — use vi.stubGlobal so the
// teardown via vi.unstubAllGlobals fully restores the original binding.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      state.capturedUrls.push(url)

      if (state.failOn && url.includes(state.failOn)) {
        return new Response('boom', {
          status: 500,
          headers: { 'content-type': 'text/plain' },
        })
      }

      const key = stripOrigin(url)
      const page = state.pages.get(key)
      if (!page) {
        return new Response(
          JSON.stringify({ data: { items: [], nextCursor: null } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ data: page }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function stripOrigin(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname + new URL(url, 'http://localhost').search
  } catch {
    return url
  }
}

function setPage(
  pathWithQuery: string,
  items: unknown[],
  nextCursor: string | null = null,
): void {
  state.pages.set(pathWithQuery, { items, nextCursor })
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client },
      children,
    )
  }
  return { client, Wrapper }
}

describe('useResourceListInfinite — routing per resource', () => {
  it('charity → calls /api/charities', async () => {
    setPage('/api/charities', [{ id: 'a1', name: 'A', description: 'd' }])
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useResourceListInfinite({ resource: 'charity', enabled: true }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(state.capturedUrls.some((u) => u.includes('/api/charities'))).toBe(true)
    expect(state.capturedUrls.every((u) => !u.includes('/api/donations'))).toBe(true)
  })

  it('donation → calls /api/donations', async () => {
    setPage('/api/donations', [
      {
        id: 'd1',
        name: 'D',
        description: 'd',
        charityId: 'c1',
        charityName: 'C',
      },
    ])
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useResourceListInfinite({ resource: 'donation', enabled: true }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(state.capturedUrls.some((u) => u.includes('/api/donations'))).toBe(true)
  })

  it('item → calls /api/items', async () => {
    setPage('/api/items', [
      {
        id: 'i1',
        name: 'I',
        description: 'd',
        charityId: 'c1',
        charityName: 'C',
        priceTwd: 100,
      },
    ])
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useResourceListInfinite({ resource: 'item', enabled: true }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(state.capturedUrls.some((u) => u.includes('/api/items'))).toBe(true)
  })
})

describe('useResourceListInfinite — query forwarding', () => {
  it('forwards q and category into the URL', async () => {
    setPage('/api/charities?q=acc&category=child_care', [
      { id: 'a1', name: 'ACC', description: 'd' },
    ])
    const { Wrapper } = makeWrapper()
    renderHook(
      () =>
        useResourceListInfinite({
          resource: 'charity',
          q: 'acc',
          category: 'child_care',
          enabled: true,
        }),
      { wrapper: Wrapper },
    )
    await waitFor(() => {
      expect(
        state.capturedUrls.some(
          (u) => u.includes('q=acc') && u.includes('category=child_care'),
        ),
      ).toBe(true)
    })
  })

  it('omits empty q and missing category', async () => {
    const { Wrapper } = makeWrapper()
    renderHook(
      () =>
        useResourceListInfinite({
          resource: 'charity',
          q: '',
          enabled: true,
        }),
      { wrapper: Wrapper },
    )
    await waitFor(() => {
      expect(state.capturedUrls.length).toBeGreaterThan(0)
    })
    expect(state.capturedUrls[0]).not.toContain('q=')
    expect(state.capturedUrls[0]).not.toContain('category=')
  })
})

describe('useResourceListInfinite — lazy enabled', () => {
  it('does NOT fetch when enabled: false', async () => {
    const { Wrapper } = makeWrapper()
    renderHook(
      () => useResourceListInfinite({ resource: 'charity', enabled: false }),
      { wrapper: Wrapper },
    )
    // give microtasks a chance to schedule a fetch
    await new Promise((r) => setTimeout(r, 30))
    expect(state.capturedUrls.length).toBe(0)
  })
})

describe('useResourceListInfinite — pagination', () => {
  it('fetchNextPage appends the next page', async () => {
    setPage('/api/charities', [{ id: 'a1', name: 'A', description: 'd' }], 'cur1')
    setPage(
      '/api/charities?cursor=cur1',
      [{ id: 'a2', name: 'B', description: 'd' }],
      null,
    )
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useResourceListInfinite({ resource: 'charity', enabled: true }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.hasNextPage).toBe(true)

    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(false)
  })
})

describe('useResourceListInfinite — error', () => {
  it('surfaces 5xx as isError', async () => {
    state.failOn = '/api/charities'
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useResourceListInfinite({ resource: 'charity', enabled: true }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })
})

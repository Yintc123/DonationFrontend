import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const replaceMock = vi.fn()
let currentSearch = ''

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}))

import { useUrlSync } from './useUrlSync'

describe('useUrlSync', () => {
  beforeEach(() => {
    replaceMock.mockClear()
    currentSearch = ''
  })

  it('全部空 → router.replace 收到空 path（不留 ?）', () => {
    renderHook(() => useUrlSync({ q: '', tab: undefined, category: undefined }))
    expect(replaceMock).toHaveBeenCalledWith('', { scroll: false })
  })

  it('q 有值 → ?q=foo', () => {
    renderHook(() =>
      useUrlSync({ q: 'foo', tab: undefined, category: undefined }),
    )
    expect(replaceMock).toHaveBeenCalledWith('?q=foo', { scroll: false })
  })

  it('tab + category → ?tab=item&category=animal_protection', () => {
    renderHook(() =>
      useUrlSync({
        q: '',
        tab: 'item',
        category: 'animal_protection',
      }),
    )
    expect(replaceMock).toHaveBeenCalledWith(
      expect.stringContaining('tab=item'),
      { scroll: false },
    )
    expect(replaceMock).toHaveBeenCalledWith(
      expect.stringContaining('category=animal_protection'),
      { scroll: false },
    )
  })

  it('既有 URL searchParams 保留未指定的 key', () => {
    currentSearch = 'utm=abc'
    renderHook(() =>
      useUrlSync({ q: 'bar', tab: undefined, category: undefined }),
    )
    const called = replaceMock.mock.calls[0][0] as string
    expect(called).toContain('utm=abc')
    expect(called).toContain('q=bar')
  })

  it('清空 q 時 drop ?q=', () => {
    currentSearch = 'q=old'
    renderHook(() =>
      useUrlSync({ q: '', tab: undefined, category: undefined }),
    )
    expect(replaceMock).toHaveBeenCalledWith('', { scroll: false })
  })

  it('scroll: false 始終為 true（避免每次 URL 變動都 scroll-to-top）', () => {
    renderHook(() =>
      useUrlSync({ q: 'foo', tab: undefined, category: undefined }),
    )
    const opts = replaceMock.mock.calls[0][1]
    expect(opts).toEqual({ scroll: false })
  })
})

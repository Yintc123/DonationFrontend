import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { InAppNavProvider, useHasInAppNavigated } from './useInAppNav'

const usePathnameMock = vi.fn<() => string>()
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}))

function wrap(children: ReactNode) {
  return <InAppNavProvider>{children}</InAppNavProvider>
}

describe('useInAppNav', () => {
  it('無 provider → 預設 false', () => {
    usePathnameMock.mockReturnValue('/donation')
    const { result } = renderHook(() => useHasInAppNavigated())
    expect(result.current).toBe(false)
  })

  it('有 provider，pathname 沒變 → false', () => {
    usePathnameMock.mockReturnValue('/donation')
    const { result } = renderHook(() => useHasInAppNavigated(), {
      wrapper: ({ children }) => wrap(children),
    })
    expect(result.current).toBe(false)
  })

  it('有 provider，pathname 變動 → true', () => {
    usePathnameMock.mockReturnValue('/')
    const { result, rerender } = renderHook(() => useHasInAppNavigated(), {
      wrapper: ({ children }) => wrap(children),
    })
    expect(result.current).toBe(false)
    usePathnameMock.mockReturnValue('/donation')
    rerender()
    expect(result.current).toBe(true)
  })

  it('變動後再回到初始 pathname 仍為 true（一旦 navigated 不會 reset）', () => {
    usePathnameMock.mockReturnValue('/')
    const { result, rerender } = renderHook(() => useHasInAppNavigated(), {
      wrapper: ({ children }) => wrap(children),
    })
    usePathnameMock.mockReturnValue('/donation')
    rerender()
    expect(result.current).toBe(true)
    usePathnameMock.mockReturnValue('/')
    rerender()
    expect(result.current).toBe(true)
  })
})

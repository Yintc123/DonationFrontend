import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useSmartBack } from './useSmartBack'
import { InAppNavProvider } from './useInAppNav'

const routerBackMock = vi.fn()
const routerPushMock = vi.fn()
const usePathnameMock = vi.fn<() => string>().mockReturnValue('/')
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: routerBackMock, push: routerPushMock }),
  usePathname: () => usePathnameMock(),
}))

beforeEach(() => {
  routerBackMock.mockReset()
  routerPushMock.mockReset()
  usePathnameMock.mockReturnValue('/')
})

function wrap(children: ReactNode) {
  return <InAppNavProvider>{children}</InAppNavProvider>
}

describe('useSmartBack', () => {
  it('hasNavigated=false（無 provider）→ router.push(fallback)', () => {
    const { result } = renderHook(() => useSmartBack('/'))
    result.current()
    expect(routerPushMock).toHaveBeenCalledWith('/')
    expect(routerBackMock).not.toHaveBeenCalled()
  })

  it('hasNavigated=false（provider 內但 pathname 未變）→ router.push(fallback)', () => {
    const { result } = renderHook(() => useSmartBack('/donation'), {
      wrapper: ({ children }) => wrap(children),
    })
    result.current()
    expect(routerPushMock).toHaveBeenCalledWith('/donation')
    expect(routerBackMock).not.toHaveBeenCalled()
  })

  it('hasNavigated=true → router.back()', () => {
    usePathnameMock.mockReturnValue('/')
    const { result, rerender } = renderHook(() => useSmartBack('/'), {
      wrapper: ({ children }) => wrap(children),
    })
    // 觸發 in-app navigation
    usePathnameMock.mockReturnValue('/donation')
    rerender()
    result.current()
    expect(routerBackMock).toHaveBeenCalledTimes(1)
    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it('fallback 預設 /', () => {
    const { result } = renderHook(() => useSmartBack())
    result.current()
    expect(routerPushMock).toHaveBeenCalledWith('/')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpClientError } from './HttpClientError'

const toastErrorMock = vi.fn()
const toastDismissMock = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    dismiss: (...args: unknown[]) => toastDismissMock(...args),
  },
}))

import {
  handleGlobalQueryError,
  handleGlobalQuerySuccess,
  SERVER_5XX_TOAST_ID,
  SERVER_5XX_TOAST_DURATION_MS,
} from './globalQueryError'

beforeEach(() => {
  toastErrorMock.mockReset()
  toastDismissMock.mockReset()
})

describe('handleGlobalQueryError', () => {
  it('5xx → toast.error with id = server-5xx, duration 3s', () => {
    handleGlobalQueryError(new HttpClientError(500, 'boom'))
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    const [msg, opts] = toastErrorMock.mock.calls[0]
    expect(msg).toBe('server 目前維修中…')
    expect((opts as { id: string; duration: number }).id).toBe(SERVER_5XX_TOAST_ID)
    expect((opts as { id: string; duration: number }).duration).toBe(
      SERVER_5XX_TOAST_DURATION_MS,
    )
    expect(SERVER_5XX_TOAST_DURATION_MS).toBe(3000)
  })

  it.each([500, 502, 503, 504, 599])(
    'status %i → toast 觸發',
    (status) => {
      handleGlobalQueryError(new HttpClientError(status, 'boom'))
      expect(toastErrorMock).toHaveBeenCalledTimes(1)
    },
  )

  it.each([400, 401, 403, 404, 422])('status %i → 不 toast', (status) => {
    handleGlobalQueryError(new HttpClientError(status, 'boom'))
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('未知型別 Error / null → 不 toast', () => {
    handleGlobalQueryError(new Error('plain'))
    handleGlobalQueryError(null)
    handleGlobalQueryError(undefined)
    handleGlobalQueryError('string error')
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('id 固定 → 多次呼叫只會 upsert（sonner 由 id dedup，handler 不需自己 throttle）', () => {
    handleGlobalQueryError(new HttpClientError(500, 'a'))
    handleGlobalQueryError(new HttpClientError(503, 'b'))
    handleGlobalQueryError(new HttpClientError(502, 'c'))
    expect(toastErrorMock).toHaveBeenCalledTimes(3)
    const ids = toastErrorMock.mock.calls.map(
      (c) => (c[1] as { id: string }).id,
    )
    expect(new Set(ids)).toEqual(new Set([SERVER_5XX_TOAST_ID]))
  })
})

describe('handleGlobalQuerySuccess', () => {
  it('成功時主動 dismiss server-5xx toast', () => {
    handleGlobalQuerySuccess()
    expect(toastDismissMock).toHaveBeenCalledWith(SERVER_5XX_TOAST_ID)
  })
})

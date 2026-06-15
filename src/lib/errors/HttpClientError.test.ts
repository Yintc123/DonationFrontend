import { describe, it, expect } from 'vitest'
import { HttpClientError, getHttpStatus } from './HttpClientError'

describe('HttpClientError', () => {
  it('帶 status 與 message', () => {
    const e = new HttpClientError(503, 'maintenance')
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(HttpClientError)
    expect(e.status).toBe(503)
    expect(e.message).toBe('maintenance')
    expect(e.name).toBe('HttpClientError')
  })
})

describe('getHttpStatus', () => {
  it('HttpClientError → status', () => {
    expect(getHttpStatus(new HttpClientError(500, 'x'))).toBe(500)
    expect(getHttpStatus(new HttpClientError(404, 'x'))).toBe(404)
  })

  it('一般 Error → null', () => {
    expect(getHttpStatus(new Error('boom'))).toBeNull()
  })

  it('未知型別（string / null / undefined）→ null', () => {
    expect(getHttpStatus('boom')).toBeNull()
    expect(getHttpStatus(null)).toBeNull()
    expect(getHttpStatus(undefined)).toBeNull()
  })

  it('plain object with status number → 容許（保留彈性給未來其他 fetcher）', () => {
    expect(getHttpStatus({ status: 502 })).toBe(502)
  })

  it('plain object 但 status 非 number → null', () => {
    expect(getHttpStatus({ status: '500' })).toBeNull()
    expect(getHttpStatus({ status: null })).toBeNull()
  })
})

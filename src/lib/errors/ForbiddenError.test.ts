import { describe, it, expect } from 'vitest'
import { BffError } from './BffError'
import { ForbiddenError } from './ForbiddenError'
import { toErrorResponse } from './toErrorResponse'

describe('ForbiddenError', () => {
  it('is a BffError subclass', () => {
    expect(new ForbiddenError('x')).toBeInstanceOf(BffError)
  })

  it('code = FORBIDDEN, httpStatus = 403', () => {
    const e = new ForbiddenError('admin only')
    expect(e.code).toBe('FORBIDDEN')
    expect(e.httpStatus).toBe(403)
    expect(e.message).toBe('admin only')
  })

  it('toErrorResponse renders 403 + JSON envelope', async () => {
    const res = toErrorResponse(new ForbiddenError('admin only'), 'req-1')
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
    expect(body.error.message).toBe('admin only')
    expect(body.error.requestId).toBe('req-1')
  })
})

import { describe, it, expect } from 'vitest'
import { decodeJwtPayload } from './decodeJwtPayload'

// Hand-rolled token: header.payload.signature (signature ignored).
function makeToken(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`
}

describe('decodeJwtPayload', () => {
  it('decodes a standard JWT payload', () => {
    const token = makeToken({ sub: 'u1', role: 0, type: 'access' })
    expect(decodeJwtPayload(token)).toEqual({
      sub: 'u1',
      role: 0,
      type: 'access',
    })
  })

  it('handles base64url chars (- and _)', () => {
    // Build a payload whose base64 needs URL-safe substitutions.
    const token = makeToken({ note: '???' })
    expect(decodeJwtPayload(token)).toEqual({ note: '???' })
  })

  it('non-jwt string → null', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull()
    expect(decodeJwtPayload('')).toBeNull()
    expect(decodeJwtPayload('a.b')).toBeNull()
  })

  it('invalid base64 payload → null', () => {
    expect(decodeJwtPayload('header.@@@.sig')).toBeNull()
  })

  it('payload that decodes but isnt JSON → null', () => {
    const garbage = `${Buffer.from('header').toString('base64url')}.${Buffer.from('not-json').toString('base64url')}.sig`
    expect(decodeJwtPayload(garbage)).toBeNull()
  })
})

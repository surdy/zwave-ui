import { afterEach, describe, expect, it, vi } from 'vitest'
import { getStoredToken, isTokenValid, setSessionToken, setStoredToken } from '../auth'

function makeJwt(payload: Record<string, unknown>): string {
  const part = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/=+$/, '')
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}.sig`
}

describe('auth token helpers', () => {
  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  it('stores and clears the token', () => {
    setStoredToken('abc')
    expect(getStoredToken()).toBe('abc')
    setStoredToken(null)
    expect(getStoredToken()).toBeNull()
  })

  it('supports a non-persistent session token', () => {
    localStorage.setItem('zwui.token', 'persisted')
    setSessionToken('session')
    expect(getStoredToken()).toBe('session')
    expect(localStorage.getItem('zwui.token')).toBeNull()
    setStoredToken(null)
    expect(getStoredToken()).toBeNull()
  })

  it('rejects empty or malformed tokens', () => {
    expect(isTokenValid(null)).toBe(false)
    expect(isTokenValid('')).toBe(false)
    expect(isTokenValid('not-a-jwt')).toBe(false)
    expect(isTokenValid('only.two')).toBe(false)
  })

  it('accepts a token whose exp is in the future', () => {
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
    expect(isTokenValid(token)).toBe(true)
  })

  it('rejects an expired token', () => {
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) - 10 })
    expect(isTokenValid(token)).toBe(false)
  })

  it('accepts a token with no exp claim', () => {
    const token = makeJwt({ username: 'admin' })
    expect(isTokenValid(token)).toBe(true)
  })
})

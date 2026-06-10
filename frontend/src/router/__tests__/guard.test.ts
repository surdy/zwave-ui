import { describe, it, expect } from 'vitest'
import { resolveAuthNavigation } from '../guard'

type Matched = { meta: { requiresAuth?: boolean } }
const target = (name: string, fullPath: string, matched: Matched[]) =>
  ({ name, fullPath, matched }) as never

const shell = (name: string, fullPath: string) =>
  target(name, fullPath, [{ meta: { requiresAuth: true } }])
const open = (name: string, fullPath: string) => target(name, fullPath, [{ meta: {} }])

describe('resolveAuthNavigation', () => {
  it('allows protected routes when auth is disabled', () => {
    const r = resolveAuthNavigation(shell('dashboard', '/dashboard'), {
      authEnabled: false,
      hasValidToken: false,
    })
    expect(r).toBe(true)
  })

  it('redirects to login (preserving target) when auth is enabled and no valid token', () => {
    const r = resolveAuthNavigation(shell('devices', '/devices'), {
      authEnabled: true,
      hasValidToken: false,
    })
    expect(r).toEqual({ name: 'login', query: { redirect: '/devices' } })
  })

  it('allows protected routes when auth is enabled and token is valid', () => {
    const r = resolveAuthNavigation(shell('dashboard', '/dashboard'), {
      authEnabled: true,
      hasValidToken: true,
    })
    expect(r).toBe(true)
  })

  it('bounces away from /login when auth is disabled', () => {
    const r = resolveAuthNavigation(open('login', '/login'), {
      authEnabled: false,
      hasValidToken: false,
    })
    expect(r).toEqual({ name: 'dashboard' })
  })

  it('stays on /login when auth is enabled and not yet authenticated', () => {
    const r = resolveAuthNavigation(open('login', '/login'), {
      authEnabled: true,
      hasValidToken: false,
    })
    expect(r).toBe(true)
  })

  it('bounces away from /login when already authenticated', () => {
    const r = resolveAuthNavigation(open('login', '/login'), {
      authEnabled: true,
      hasValidToken: true,
    })
    expect(r).toEqual({ name: 'dashboard' })
  })

  it('allows public non-login routes without a token', () => {
    const r = resolveAuthNavigation(open('kitchen-sink', '/_components'), {
      authEnabled: true,
      hasValidToken: false,
    })
    expect(r).toBe(true)
  })
})

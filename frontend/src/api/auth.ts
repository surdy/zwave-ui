/**
 * Authentication API + token storage.
 *
 * Contract (api/app.ts):
 *  - GET  /api/auth-enabled   -> { success, data: boolean }
 *  - POST /api/authenticate   -> { success, code?, message, user?: { token } }
 *  - GET  /api/logout         -> { success }
 *
 * When auth is enabled, the JWT from `user.token` is passed to socket.io via
 * the `auth: { token }` handshake option.
 */
import { getJson, postJson } from './rest'

const TOKEN_KEY = 'zwui.token'

let sessionToken: string | null = null

export interface AuthUser {
  username?: string
  token?: string
  [extra: string]: unknown
}

export interface AuthenticateResult {
  success: boolean
  code?: number
  message?: string
  user?: AuthUser
}

export function getStoredToken(): string | null {
  if (sessionToken) return sessionToken
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token: string | null): void {
  sessionToken = null
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable; ignore */
  }
}

export function setSessionToken(token: string | null): void {
  sessionToken = token
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable; ignore */
  }
}

/** True if the JWT is structurally valid and not expired. */
export function isTokenValid(token: string | null | undefined): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(atob(parts[1])) as { exp?: number }
    if (payload.exp && payload.exp * 1000 < Date.now()) return false
    return true
  } catch {
    return false
  }
}

export async function fetchAuthEnabled(): Promise<boolean> {
  const res = await getJson<{ success: boolean; data: boolean }>('/api/auth-enabled')
  return Boolean(res?.data)
}

export async function authenticate(username: string, password: string): Promise<AuthenticateResult> {
  const res = await postJson<AuthenticateResult>('/api/authenticate', { username, password })
  if (res?.success && res.user?.token) setStoredToken(res.user.token)
  return res
}

/** Restore a session from a stored token. */
export async function authenticateWithToken(token: string): Promise<AuthenticateResult> {
  const res = await postJson<AuthenticateResult>('/api/authenticate', { token })
  if (res?.success && res.user?.token) setStoredToken(res.user.token)
  return res
}

export async function logout(): Promise<void> {
  try {
    await getJson('/api/logout')
  } finally {
    setStoredToken(null)
  }
}

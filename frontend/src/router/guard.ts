/**
 * Pure navigation-guard decision, split out from the router so it can be unit
 * tested without a DOM/history. Given the target route and the resolved auth
 * state, returns `true` to allow navigation or a redirect target.
 */
import type { RouteLocationNormalized } from 'vue-router'

export interface AuthState {
  /** Whether the backend requires authentication. */
  authEnabled: boolean
  /** Whether a currently-valid session token is held. */
  hasValidToken: boolean
}

export type GuardDecision = true | { name: string; query?: Record<string, string> }

type GuardTarget = Pick<RouteLocationNormalized, 'name' | 'matched' | 'fullPath'>

export function resolveAuthNavigation(to: GuardTarget, auth: AuthState): GuardDecision {
  const requiresAuth = to.matched.some((r) => r.meta?.requiresAuth)
  const authed = !auth.authEnabled || auth.hasValidToken

  if (to.name === 'login') {
    // Don't strand an already-authenticated (or open) instance on the login screen.
    return authed ? { name: 'dashboard' } : true
  }
  if (requiresAuth && !authed) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
}

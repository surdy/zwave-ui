import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { fetchAuthEnabled, getStoredToken, isTokenValid } from '@/api'
import { resolveAuthNavigation } from './guard'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Sign in', public: true },
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppShell.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'dashboard' } },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: 'Dashboard' },
      },
      {
        path: 'devices',
        name: 'devices',
        component: () => import('@/views/DevicesView.vue'),
        meta: { title: 'Devices' },
      },
      {
        path: 'add',
        name: 'add',
        component: () => import('@/views/AddView.vue'),
        meta: { title: 'Add a device' },
      },
      {
        path: 'network',
        name: 'network',
        component: () => import('@/views/NetworkView.vue'),
        meta: { title: 'Network' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: 'Settings' },
      },
    ],
  },
]

if (import.meta.env.DEV) {
  routes.push({
    path: '/_components',
    name: 'kitchen-sink',
    component: () => import('@/views/KitchenSinkView.vue'),
    meta: { public: true },
  })
}

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * Whether the backend requires authentication. Probed once and cached so the
 * guard stays synchronous after the first navigation.
 */
let authEnabledCache: boolean | null = null
async function isAuthEnabled(): Promise<boolean> {
  if (authEnabledCache === null) {
    try {
      authEnabledCache = await fetchAuthEnabled()
    } catch {
      // If we can't determine it, don't lock the user out; the socket will
      // surface a connect error if auth is genuinely required.
      authEnabledCache = false
    }
  }
  return authEnabledCache
}

router.beforeEach(async (to) => {
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)
  // Public routes that aren't the login screen need no auth probe.
  if (!requiresAuth && to.name !== 'login') return true

  const authEnabled = await isAuthEnabled()
  return resolveAuthNavigation(to, {
    authEnabled,
    hasValidToken: isTokenValid(getStoredToken()),
  })
})

export default router

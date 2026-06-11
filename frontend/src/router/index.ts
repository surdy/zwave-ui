import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { fetchAuthEnabled, getStoredToken, isTokenValid } from '@/api'
import { landingRouteName, loadPreferences } from '@/settings/preferences'
import { resolveAuthNavigation } from './guard'

function defaultLandingRoute() {
  try {
    return { name: landingRouteName(loadPreferences(localStorage).landingScreen) }
  } catch {
    return { name: 'dashboard' }
  }
}

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
      { path: '', redirect: defaultLandingRoute },
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
        path: 'devices/:id',
        name: 'device-detail',
        component: () => import('@/views/DeviceDetailView.vue'),
        meta: { title: 'Device' },
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
        path: 'network/maintenance',
        name: 'controller-maintenance',
        component: () => import('@/views/ControllerMaintenanceView.vue'),
        meta: { title: 'Controller maintenance' },
      },
      {
        path: 'network/logs',
        name: 'diagnostics-logs',
        component: () => import('@/views/DebugLogView.vue'),
        meta: { title: 'Debug log' },
      },
      {
        path: 'network/zniffer',
        name: 'diagnostics-zniffer',
        component: () => import('@/views/ZnifferView.vue'),
        meta: { title: 'Zniffer' },
      },
      {
        path: 'automations',
        name: 'automations',
        component: () => import('@/views/AutomationsView.vue'),
        meta: { title: 'Automations' },
      },
      {
        path: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: 'Settings' },
        children: [
          { path: '', redirect: { name: 'settings-general' } },
          {
            path: 'general',
            name: 'settings-general',
            component: () => import('@/views/settings/GeneralSettings.vue'),
            meta: { title: 'General' },
          },
          {
            path: 'zwave',
            name: 'settings-zwave',
            component: () => import('@/views/settings/ZwaveSettings.vue'),
            meta: { title: 'Z-Wave' },
          },
          {
            path: 'integrations',
            name: 'settings-integrations',
            component: () => import('@/views/settings/IntegrationsSettings.vue'),
            meta: { title: 'Integrations' },
          },
          {
            path: 'backup',
            name: 'settings-backup',
            component: () => import('@/views/settings/BackupSettings.vue'),
            meta: { title: 'Backup' },
          },
          {
            path: 'system',
            name: 'settings-system',
            component: () => import('@/views/settings/SystemSettings.vue'),
            meta: { title: 'System' },
          },
        ],
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

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppShell from '@/components/layout/AppShell.vue'
import { useUiStore } from '@/stores/ui'

// The shell opens a realtime connection on mount; stub it so this stays a pure
// render test (connectivity is covered by the store/api unit tests).
vi.mock('@/composables/useZwaveConnection', () => ({
  useZwaveConnection: () => ({
    connect: vi.fn().mockResolvedValue(null),
    disconnect: vi.fn(),
  }),
}))

// Stub vue-router so we can mount the shell without a full router instance.
vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'dashboard', meta: { title: 'Dashboard' } }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
  RouterView: { name: 'RouterView', template: '<div class="router-view" />' },
}))

describe('AppShell', () => {
  it('renders the brand and all primary navigation areas', () => {
    const wrapper = mount(AppShell, {
      global: { plugins: [createPinia()] },
    })
    const text = wrapper.text()
    expect(text).toContain('Z-Wave UI')
    expect(text).toContain('Dashboard')
    expect(text).toContain('Devices')
    expect(text).toContain('Add')
    expect(text).toContain('Network')
    expect(text).toContain('Settings')
  })

  it('hides Automations until Advanced mode is enabled', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(AppShell, { global: { plugins: [pinia] } })
    expect(wrapper.text()).not.toContain('Automations')

    useUiStore().setAdvanced(true)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Automations')
  })
})

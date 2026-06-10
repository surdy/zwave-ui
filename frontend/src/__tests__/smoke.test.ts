import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import HomeView from '../views/HomeView.vue'

// HomeView opens a realtime connection on mount; stub it so this stays a
// pure render test (connectivity is covered by the store/api unit tests).
vi.mock('@/composables/useZwaveConnection', () => ({
  useZwaveConnection: () => ({
    connect: vi.fn().mockResolvedValue(null),
    disconnect: vi.fn(),
  }),
}))

describe('HomeView', () => {
  it('renders the application name', () => {
    const wrapper = mount(HomeView, {
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toContain('Z-Wave UI')
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '@/stores/ui'
import AdvancedOnly from '../AdvancedOnly.vue'

describe('AdvancedOnly', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('hides its slot when advanced mode is off', () => {
    const wrapper = mount(AdvancedOnly, {
      slots: { default: '<span class="secret">expert</span>' },
    })
    expect(wrapper.find('.secret').exists()).toBe(false)
  })

  it('shows its slot when advanced mode is on', async () => {
    const ui = useUiStore()
    ui.setAdvanced(true)
    const wrapper = mount(AdvancedOnly, {
      slots: { default: '<span class="secret">expert</span>' },
    })
    expect(wrapper.find('.secret').exists()).toBe(true)
  })
})

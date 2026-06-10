import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseSwitch from '../BaseSwitch.vue'

describe('BaseSwitch', () => {
  it('exposes a switch role reflecting the model', () => {
    const wrapper = mount(BaseSwitch, { props: { modelValue: true, label: 'Enabled' } })
    const sw = wrapper.get('[role="switch"]')
    expect(sw.attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).toContain('Enabled')
  })

  it('toggles on click', async () => {
    const wrapper = mount(BaseSwitch, { props: { modelValue: false } })
    await wrapper.get('[role="switch"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('toggles on Space/Enter', async () => {
    const wrapper = mount(BaseSwitch, { props: { modelValue: false } })
    await wrapper.get('[role="switch"]').trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('does not toggle when disabled', async () => {
    const wrapper = mount(BaseSwitch, { props: { modelValue: false, disabled: true } })
    await wrapper.get('[role="switch"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

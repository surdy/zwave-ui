import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import ConfirmHost from '../ConfirmHost.vue'
import BaseButton from '../BaseButton.vue'
import { useConfirm } from '@/composables/useConfirm'

function mountHost() {
  return mount(ConfirmHost, {
    global: { plugins: [createPinia()], stubs: { teleport: true } },
  })
}

async function clickButtonByText(wrapper: ReturnType<typeof mountHost>, text: string) {
  const btn = wrapper.findAllComponents(BaseButton).find((b) => b.text().includes(text))
  if (!btn) throw new Error(`button "${text}" not found`)
  await btn.get('button').trigger('click')
}

describe('confirm() / prompt() flow', () => {
  it('resolves true when confirmed', async () => {
    const wrapper = mountHost()
    const { confirm } = useConfirm()
    const p = confirm({ title: 'Remove?', confirmText: 'Remove', danger: true })
    await nextTick()
    expect(wrapper.text()).toContain('Remove?')
    await clickButtonByText(wrapper, 'Remove')
    await expect(p).resolves.toBe(true)
  })

  it('resolves false when cancelled', async () => {
    const wrapper = mountHost()
    const { confirm } = useConfirm()
    const p = confirm({ title: 'Remove?', cancelText: 'Cancel' })
    await nextTick()
    await clickButtonByText(wrapper, 'Cancel')
    await expect(p).resolves.toBe(false)
  })

  it('prompt() resolves the entered value', async () => {
    const wrapper = mountHost()
    const { prompt } = useConfirm()
    const p = prompt({
      title: 'Rename',
      confirmText: 'Save',
      input: { type: 'text', label: 'Name', default: 'lamp' },
    })
    await nextTick()
    const input = wrapper.get('input')
    await input.setValue('kitchen lamp')
    await clickButtonByText(wrapper, 'Save')
    await expect(p).resolves.toBe('kitchen lamp')
  })

  it('prompt() resolves null when cancelled', async () => {
    const wrapper = mountHost()
    const { prompt } = useConfirm()
    const p = prompt({ title: 'Rename', input: { type: 'text' } })
    await nextTick()
    await clickButtonByText(wrapper, 'Cancel')
    await expect(p).resolves.toBeNull()
  })

  it('runs requests sequentially', async () => {
    const wrapper = mountHost()
    const { confirm } = useConfirm()
    const first = confirm({ title: 'First' })
    const second = confirm({ title: 'Second' })
    await nextTick()
    expect(wrapper.text()).toContain('First')
    expect(wrapper.text()).not.toContain('Second')
    await clickButtonByText(wrapper, 'Confirm')
    await flushPromises()
    expect(await first).toBe(true)
    await nextTick()
    expect(wrapper.text()).toContain('Second')
    await clickButtonByText(wrapper, 'Confirm')
    await expect(second).resolves.toBe(true)
  })
})

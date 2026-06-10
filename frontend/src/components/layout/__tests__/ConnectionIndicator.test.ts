import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ConnectionIndicator from '../ConnectionIndicator.vue'
import { useControllerStore } from '@/stores/controller'
import type { ConnectionStatus } from '@/api'

beforeEach(() => {
  setActivePinia(createPinia())
})

function labelFor(status: ConnectionStatus): string {
  const controller = useControllerStore()
  controller.setStatus(status)
  return mount(ConnectionIndicator).text()
}

describe('ConnectionIndicator', () => {
  it('maps each connection status to a human label', () => {
    expect(labelFor('connected')).toContain('Connected')
    expect(labelFor('connecting')).toContain('Connecting')
    expect(labelFor('reconnecting')).toContain('Reconnecting')
    expect(labelFor('error')).toContain('Disconnected')
    expect(labelFor('disconnected')).toContain('Offline')
    expect(labelFor('idle')).toContain('Idle')
  })

  it('hides the text label in compact mode but keeps an accessible name', () => {
    const controller = useControllerStore()
    controller.setStatus('connected')
    const wrapper = mount(ConnectionIndicator, { props: { compact: true } })
    expect(wrapper.find('.conn__label').exists()).toBe(false)
    expect(wrapper.get('.conn').attributes('aria-label')).toContain('Connected')
  })
})

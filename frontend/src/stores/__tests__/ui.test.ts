import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '../ui'

describe('ui store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to system theme and advanced off', () => {
    const ui = useUiStore()
    expect(ui.theme).toBe('system')
    expect(ui.advanced).toBe(false)
  })

  it('persists the theme and applies it to the document', () => {
    const ui = useUiStore()
    ui.setTheme('dark')
    expect(ui.theme).toBe('dark')
    expect(ui.resolvedTheme).toBe('dark')
    expect(localStorage.getItem('zwui.theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('toggles and persists advanced mode', () => {
    const ui = useUiStore()
    ui.toggleAdvanced()
    expect(ui.advanced).toBe(true)
    expect(localStorage.getItem('zwui.advanced')).toBe('true')
    ui.toggleAdvanced()
    expect(ui.advanced).toBe(false)
  })

  it('reads persisted values on initialization', () => {
    localStorage.setItem('zwui.theme', 'light')
    localStorage.setItem('zwui.advanced', 'true')
    setActivePinia(createPinia())
    const ui = useUiStore()
    expect(ui.theme).toBe('light')
    expect(ui.advanced).toBe(true)
  })
})

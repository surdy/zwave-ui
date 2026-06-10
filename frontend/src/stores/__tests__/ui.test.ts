import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '../ui'

describe('ui store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to system theme, advanced off, and app preferences', () => {
    const ui = useUiStore()
    expect(ui.theme).toBe('system')
    expect(ui.advanced).toBe(false)
    expect(ui.locale).toBe('en')
    expect(ui.unit).toBe('celsius')
    expect(ui.devicesView).toBe('cards')
    expect(ui.landingScreen).toBe('dashboard')
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

  it('persists app preferences', () => {
    const ui = useUiStore()
    ui.setLocale('en')
    ui.setUnit('fahrenheit')
    ui.setDevicesView('table')
    ui.setLandingScreen('settings-general')

    expect(localStorage.getItem('zwui.locale')).toBe('en')
    expect(localStorage.getItem('zwui.unit')).toBe('fahrenheit')
    expect(localStorage.getItem('zwui.devicesView')).toBe('table')
    expect(localStorage.getItem('zwui.landingScreen')).toBe('settings-general')
  })

  it('reads persisted values on initialization', () => {
    localStorage.setItem('zwui.theme', 'light')
    localStorage.setItem('zwui.advanced', 'true')
    localStorage.setItem('zwui.unit', 'fahrenheit')
    localStorage.setItem('zwui.devicesView', 'table')
    localStorage.setItem('zwui.landingScreen', 'settings-general')
    setActivePinia(createPinia())
    const ui = useUiStore()
    expect(ui.theme).toBe('light')
    expect(ui.advanced).toBe(true)
    expect(ui.unit).toBe('fahrenheit')
    expect(ui.devicesView).toBe('table')
    expect(ui.landingScreen).toBe('settings-general')
  })
})

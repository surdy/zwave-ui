import { describe, expect, it } from 'vitest'
import {
  defaultPreferences,
  devicesViewLabel,
  isValidDevicesView,
  isValidLocale,
  isValidUnit,
  landingRouteName,
  loadPreferences,
  localeLabel,
  savePreference,
  unitSymbol,
  type StorageLike,
} from '../preferences'

class FakeStorage implements StorageLike {
  private values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('settings preferences', () => {
  it('loads defaults when storage is empty', () => {
    expect(loadPreferences(new FakeStorage())).toEqual(defaultPreferences)
  })

  it('persists and reloads app preferences', () => {
    const storage = new FakeStorage()

    savePreference(storage, 'locale', 'en')
    savePreference(storage, 'unit', 'fahrenheit')
    savePreference(storage, 'devicesView', 'table')
    savePreference(storage, 'landingScreen', 'settings-general')

    expect(loadPreferences(storage)).toEqual({
      locale: 'en',
      unit: 'fahrenheit',
      devicesView: 'table',
      landingScreen: 'settings-general',
    })
  })

  it('rejects invalid stored values', () => {
    const storage = new FakeStorage()
    storage.setItem('zwui.locale', 'pirate')
    storage.setItem('zwui.unit', 'kelvin')
    storage.setItem('zwui.devicesView', 'spreadsheet')
    storage.setItem('zwui.landingScreen', 'unknown')

    expect(loadPreferences(storage)).toEqual(defaultPreferences)
    expect(isValidLocale('en')).toBe(true)
    expect(isValidLocale('pirate')).toBe(false)
    expect(isValidUnit('celsius')).toBe(true)
    expect(isValidUnit('kelvin')).toBe(false)
    expect(isValidDevicesView('cards')).toBe(true)
    expect(isValidDevicesView('spreadsheet')).toBe(false)
  })

  it('maps preference values to display metadata', () => {
    expect(localeLabel('en')).toBe('English')
    expect(unitSymbol('fahrenheit')).toBe('°F')
    expect(devicesViewLabel('table')).toBe('Table')
    expect(landingRouteName('settings-general')).toBe('settings-general')
  })
})

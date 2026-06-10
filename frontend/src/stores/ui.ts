/**
 * UI preferences store: theme, progressive-disclosure advanced mode, and
 * app-only settings persisted in localStorage.
 */
import { defineStore } from 'pinia'
import {
  defaultPreferences,
  loadPreferences,
  savePreference,
  type DevicesViewPreference,
  type LandingScreenPreference,
  type LocalePreference,
  type UnitPreference,
} from '@/settings/preferences'

export type ThemePreference = 'light' | 'dark' | 'system'

const THEME_KEY = 'zwui.theme'
const ADVANCED_KEY = 'zwui.advanced'

function readStored<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) ?? fallback
  } catch {
    return fallback
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === 'true'
  } catch {
    return fallback
  }
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function readAppPreferences() {
  try {
    return loadPreferences(localStorage)
  } catch {
    return defaultPreferences
  }
}

function persistPreference<K extends keyof typeof defaultPreferences>(
  key: K,
  value: (typeof defaultPreferences)[K],
): void {
  try {
    savePreference(localStorage, key, value)
  } catch {
    /* ignore */
  }
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: readStored<ThemePreference>(THEME_KEY, 'system'),
    advanced: readBool(ADVANCED_KEY, false),
    ...readAppPreferences(),
  }),
  getters: {
    /** Resolved theme actually applied to the document. */
    resolvedTheme(state): 'light' | 'dark' {
      if (state.theme === 'system') return systemPrefersDark() ? 'dark' : 'light'
      return state.theme
    },
  },
  actions: {
    setTheme(theme: ThemePreference) {
      this.theme = theme
      persist(THEME_KEY, theme)
      this.applyTheme()
    },
    applyTheme() {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', this.resolvedTheme)
      }
    },
    setAdvanced(value: boolean) {
      this.advanced = value
      persist(ADVANCED_KEY, String(value))
    },
    toggleAdvanced() {
      this.setAdvanced(!this.advanced)
    },
    setLocale(value: LocalePreference) {
      this.locale = value
      persistPreference('locale', value)
    },
    setUnit(value: UnitPreference) {
      this.unit = value
      persistPreference('unit', value)
    },
    setDevicesView(value: DevicesViewPreference) {
      this.devicesView = value
      persistPreference('devicesView', value)
    },
    setLandingScreen(value: LandingScreenPreference) {
      this.landingScreen = value
      persistPreference('landingScreen', value)
    },
  },
})

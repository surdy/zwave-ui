/**
 * UI preferences store: theme + the progressive-disclosure "advanced mode".
 *
 * The 3-tier disclosure model (see docs/03-ux-design/design-principles.md):
 *   - Basic    🟢 always visible
 *   - Advanced 🔵 gated behind `advanced` (this global toggle), persisted
 *   - Expert   🔴 badged + confirmation-guarded at the component level
 */
import { defineStore } from 'pinia'

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
  },
})

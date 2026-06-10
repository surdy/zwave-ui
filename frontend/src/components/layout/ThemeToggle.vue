<script setup lang="ts">
/**
 * Theme toggle bound to the `ui` store. Cycles System → Light → Dark, honouring
 * the store's three-way preference (system follows prefers-color-scheme).
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore, type ThemePreference } from '@/stores/ui'
import BaseIcon from '@/components/base/BaseIcon.vue'

const ui = useUiStore()
const { theme } = storeToRefs(ui)

const order: ThemePreference[] = ['system', 'light', 'dark']
const meta: Record<ThemePreference, { icon: string; label: string }> = {
  system: { icon: 'monitor', label: 'System' },
  light: { icon: 'sun', label: 'Light' },
  dark: { icon: 'moon', label: 'Dark' },
}

const current = computed(() => meta[theme.value])

function cycle() {
  const next = order[(order.indexOf(theme.value) + 1) % order.length]
  ui.setTheme(next)
}
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :title="`Theme: ${current.label} (click to change)`"
    :aria-label="`Theme: ${current.label}. Click to change.`"
    @click="cycle"
  >
    <BaseIcon :name="current.icon" :size="20" />
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.theme-toggle:hover {
  background: var(--color-surface-2);
}
.theme-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>

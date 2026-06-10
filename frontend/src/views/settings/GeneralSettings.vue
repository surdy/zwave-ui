<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseSelect, { type SelectOption } from '@/components/base/BaseSelect.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import { useUiStore, type ThemePreference } from '@/stores/ui'
import {
  devicesViews,
  landingScreens,
  locales,
  units,
  unitSymbol,
  type DevicesViewPreference,
  type LandingScreenPreference,
  type LocalePreference,
  type UnitPreference,
} from '@/settings/preferences'

const ui = useUiStore()
const { advanced } = storeToRefs(ui)
const savedAt = ref<Date | null>(null)

const themeOptions: SelectOption[] = [
  { label: 'System default', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]
const localeOptions: SelectOption[] = locales.map((locale) => ({
  label: locale.label,
  value: locale.value,
}))
const unitOptions: SelectOption[] = units.map((unit) => ({ label: unit.label, value: unit.value }))
const devicesViewOptions: SelectOption[] = devicesViews.map((view) => ({
  label: view.label,
  value: view.value,
}))
const landingScreenOptions: SelectOption[] = landingScreens.map((screen) => ({
  label: screen.label,
  value: screen.value,
}))

function markSaved() {
  savedAt.value = new Date()
}

const theme = computed<ThemePreference>({
  get: () => ui.theme,
  set: (value) => {
    ui.setTheme(value)
    markSaved()
  },
})
const defaultAdvanced = computed<boolean>({
  get: () => advanced.value,
  set: (value) => {
    ui.setAdvanced(value)
    markSaved()
  },
})
const locale = computed<LocalePreference>({
  get: () => ui.locale,
  set: (value) => {
    ui.setLocale(value)
    markSaved()
  },
})
const unit = computed<UnitPreference>({
  get: () => ui.unit,
  set: (value) => {
    ui.setUnit(value)
    markSaved()
  },
})
const devicesView = computed<DevicesViewPreference>({
  get: () => ui.devicesView,
  set: (value) => {
    ui.setDevicesView(value)
    markSaved()
  },
})
const landingScreen = computed<LandingScreenPreference>({
  get: () => ui.landingScreen,
  set: (value) => {
    ui.setLandingScreen(value)
    markSaved()
  },
})

const resolvedThemeLabel = computed(() => (ui.resolvedTheme === 'dark' ? 'Dark' : 'Light'))
const unitPreview = computed(() => `Temperature values display in ${unitSymbol(ui.unit)}.`)
const savedMessage = computed(() => {
  if (!savedAt.value) return 'Preferences save automatically on this device.'
  return `Saved ${savedAt.value.toLocaleTimeString()}`
})
</script>

<template>
  <div class="general-settings">
    <header class="page-header">
      <div>
        <p class="page-header__kicker">General & Appearance</p>
        <h2>Personalize the app</h2>
        <p>These app-only preferences are stored locally and applied immediately.</p>
      </div>
      <span class="save-status" aria-live="polite">{{ savedMessage }}</span>
    </header>

    <BaseCard>
      <template #header>Appearance</template>
      <div class="settings-grid">
        <BaseSelect
          v-model="theme"
          label="Theme"
          :options="themeOptions"
          :hint="`Currently resolved to ${resolvedThemeLabel}.`"
        />
        <div class="setting-row">
          <div>
            <h3>Default advanced mode</h3>
            <p>Show advanced controls by default when the app opens.</p>
          </div>
          <BaseSwitch v-model="defaultAdvanced" label="Advanced mode" />
        </div>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>Language & units</template>
      <div class="settings-grid settings-grid--two">
        <BaseSelect
          v-model="locale"
          label="Language"
          :options="localeOptions"
          hint="English is available now; more locales can plug into this scaffold later."
        />
        <BaseSelect v-model="unit" label="Temperature units" :options="unitOptions" :hint="unitPreview" />
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>App defaults</template>
      <div class="settings-grid settings-grid--two">
        <BaseSelect
          v-model="devicesView"
          label="Default Devices view"
          :options="devicesViewOptions"
          hint="Cards are optimized for touch; table is useful for dense desktop scanning."
        />
        <BaseSelect
          v-model="landingScreen"
          label="Default landing screen"
          :options="landingScreenOptions"
          hint="Used by future launch shortcuts and onboarding flows."
        />
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.general-settings {
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
}
.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.page-header__kicker {
  margin: 0 0 var(--s-1);
  color: var(--color-primary-strong);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.page-header h2 {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 2rem);
}
.page-header p {
  margin: var(--s-2) 0 0;
  color: var(--color-text-muted);
}
.save-status {
  align-self: flex-start;
  padding: var(--s-2) var(--s-3);
  color: var(--color-primary-strong);
  background: var(--color-primary-soft);
  border-radius: var(--r-pill);
  font-size: 0.8125rem;
  font-weight: 700;
}
.settings-grid {
  display: grid;
  gap: var(--s-5);
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  padding: var(--s-4);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
}
.setting-row h3 {
  margin: 0;
  font-size: 0.9375rem;
}
.setting-row p {
  margin: var(--s-1) 0 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

@media (min-width: 720px) {
  .page-header {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
  .settings-grid--two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

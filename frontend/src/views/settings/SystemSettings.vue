<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { fetchAuthEnabled } from '@/api/auth'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseSelect, { type SelectOption } from '@/components/base/BaseSelect.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import {
  LOG_LEVELS,
  changePassword,
  checkConfigUpdates,
  fetchHealth,
  fetchVersion,
  fromSettings,
  installConfigUpdate,
  isValidNewPassword,
  loadSystemSettings,
  passwordsMatch,
  restartApp,
  saveSystemSettings,
  type HealthStatus,
  type SystemSettingsForm,
  type VersionInfo,
} from '@/settings/system'

const version = ref<VersionInfo | null>(null)
const health = ref<HealthStatus | null>(null)
const form = reactive<SystemSettingsForm>(fromSettings({ settings: {} }))
const passwords = reactive({ current: '', next: '', confirm: '' })
const loading = ref(false)
const saving = ref(false)
const changingPassword = ref(false)
const checkingUpdates = ref(false)
const installingUpdate = ref(false)
const restarting = ref(false)
const updateVersion = ref<string | null>(null)
const checkedUpdates = ref(false)
const savedAt = ref<Date | null>(null)

const toast = useToast()
const { confirm } = useConfirm()

const logLevelOptions: SelectOption[] = LOG_LEVELS.map((level) => ({ label: level.label, value: level.value }))
const versionRows = computed(() => [
  { label: 'Z-Wave UI', value: version.value?.appVersion ?? 'Loading…' },
  { label: 'Z-Wave JS driver', value: version.value?.zwavejs ?? 'Loading…' },
  { label: 'Z-Wave JS Server', value: version.value?.zwavejsServer ?? 'Loading…' },
])
const passwordError = computed(() => {
  if (!passwords.next && !passwords.confirm) return ''
  if (!isValidNewPassword(passwords.next)) return 'Use at least 8 characters.'
  if (!passwordsMatch(passwords.next, passwords.confirm)) return 'Passwords do not match.'
  return ''
})
const canChangePassword = computed(
  () => passwords.current.length > 0 && passwords.next.length > 0 && passwords.confirm.length > 0 && !passwordError.value,
)
const savedMessage = computed(() => (savedAt.value ? `Saved ${savedAt.value.toLocaleTimeString()}` : 'System settings save to the backend.'))
const updateMessage = computed(() => {
  if (updateVersion.value) return `Config DB ${updateVersion.value} is available.`
  return checkedUpdates.value ? 'Device config database is up to date.' : 'Check for newer device configuration metadata.'
})

function replaceForm(next: SystemSettingsForm) {
  Object.assign(form, next)
  form.gatewayExtra = { ...next.gatewayExtra }
  form.zwaveExtra = { ...next.zwaveExtra }
}

function healthDot(ok: boolean | undefined): 'ok' | 'danger' | 'idle' {
  if (ok === undefined) return 'idle'
  return ok ? 'ok' : 'danger'
}

async function loadSystem() {
  loading.value = true
  try {
    const [settings, authEnabled, versionInfo, healthStatus] = await Promise.all([
      loadSystemSettings(),
      fetchAuthEnabled(),
      fetchVersion(),
      fetchHealth(),
    ])
    replaceForm({ ...settings, authEnabled })
    version.value = versionInfo
    health.value = healthStatus
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Unable to load system settings.')
  } finally {
    loading.value = false
  }
}

async function refreshHealth() {
  try {
    health.value = await fetchHealth()
    toast.success('Health status refreshed.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Unable to refresh health status.')
  }
}

async function saveSettings() {
  saving.value = true
  try {
    await saveSystemSettings(form)
    savedAt.value = new Date()
    toast.success('System settings saved.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Unable to save system settings.')
  } finally {
    saving.value = false
  }
}

async function submitPassword() {
  if (!canChangePassword.value) {
    toast.error(passwordError.value || 'Complete the password form before saving.')
    return
  }

  changingPassword.value = true
  try {
    const result = await changePassword(passwords.current, passwords.next)
    if (!result.success) throw new Error(result.message || 'Password update failed.')
    passwords.current = ''
    passwords.next = ''
    passwords.confirm = ''
    toast.success(result.message || 'Admin password updated.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Unable to update password.')
  } finally {
    changingPassword.value = false
  }
}

async function checkUpdates() {
  checkingUpdates.value = true
  try {
    const result = await checkConfigUpdates()
    if (!result.success) throw new Error(result.message || 'Config update check failed.')
    updateVersion.value = typeof result.result === 'string' && result.result ? result.result : null
    checkedUpdates.value = true
    toast.info(updateVersion.value ? `Config DB update ${updateVersion.value} is available.` : 'Config DB is up to date.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Unable to check for config updates.')
  } finally {
    checkingUpdates.value = false
  }
}

async function installUpdate() {
  const confirmed = await confirm({
    title: 'Install config DB update?',
    message: 'The Z-Wave driver may need to restart after the updated device configuration is installed.',
    confirmText: 'Install update',
  })
  if (!confirmed) return

  installingUpdate.value = true
  try {
    const result = await installConfigUpdate()
    if (!result.success) throw new Error(result.message || 'Config update install failed.')
    updateVersion.value = null
    checkedUpdates.value = true
    toast.success(result.message || 'Config DB update installed.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Unable to install config update.')
  } finally {
    installingUpdate.value = false
  }
}

async function restartDriver() {
  const confirmed = await confirm({
    title: 'Restart app and driver?',
    message: 'The socket will reconnect automatically once the backend finishes restarting.',
    confirmText: 'Restart',
    danger: true,
  })
  if (!confirmed) return

  restarting.value = true
  try {
    const result = await restartApp()
    if (!result.success) throw new Error(result.message || 'Restart failed.')
    toast.info(result.message || 'Restart requested. Reconnecting…', { timeout: 8000 })
    window.setTimeout(() => {
      restarting.value = false
    }, 8000)
  } catch (err) {
    restarting.value = false
    toast.error(err instanceof Error ? err.message : 'Unable to restart.')
  }
}

onMounted(loadSystem)
</script>

<template>
  <form class="system-settings" @submit.prevent="saveSettings">
    <header class="page-header">
      <div>
        <p class="page-header__kicker">System, users & access</p>
        <h2>Manage runtime, authentication, and diagnostics</h2>
        <p>Review version and health, update the device config DB, and manage the single admin account.</p>
      </div>
      <span class="save-status" aria-live="polite">{{ savedMessage }}</span>
    </header>

    <BaseCard>
      <template #header>About & health</template>
      <div class="settings-grid">
        <div class="version-grid">
          <div v-for="row in versionRows" :key="row.label" class="info-tile">
            <span>{{ row.label }}</span>
            <strong>{{ row.value }}</strong>
          </div>
        </div>

        <div class="health-grid" aria-live="polite">
          <div class="health-row">
            <StatusDot :status="healthDot(health?.overall)" :pulse="loading" label="Overall health" />
            <span>Overall</span>
            <BaseBadge :variant="health?.overall ? 'success' : health ? 'danger' : 'neutral'">
              {{ health?.details.overall ?? 'Loading…' }}
            </BaseBadge>
          </div>
          <div class="health-row">
            <StatusDot :status="healthDot(health?.zwave)" :pulse="loading" label="Z-Wave health" />
            <span>Z-Wave</span>
            <BaseBadge :variant="health?.zwave ? 'success' : health ? 'danger' : 'neutral'">
              {{ health?.details.zwave ?? 'Loading…' }}
            </BaseBadge>
          </div>
          <div class="health-row">
            <StatusDot :status="healthDot(health?.mqtt)" :pulse="loading" label="MQTT health" />
            <span>MQTT</span>
            <BaseBadge :variant="health?.mqtt ? 'success' : health ? 'danger' : 'neutral'">
              {{ health?.details.mqtt ?? 'Loading…' }}
            </BaseBadge>
          </div>
        </div>

        <div class="link-list">
          <a href="https://github.com/surdy/zwave-ui" target="_blank" rel="noreferrer">Repository</a>
          <a href="/docs" target="_blank" rel="noreferrer">Documentation</a>
          <a href="https://github.com/surdy/zwave-ui/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT license</a>
          <BaseButton variant="secondary" :disabled="loading" @click="refreshHealth">Refresh health</BaseButton>
        </div>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>Authentication & users</template>
      <div class="settings-grid">
        <div class="setting-row">
          <div>
            <h3>Password protection</h3>
            <p>Default upstream access is the single admin user. Changing auth may require re-login or restart.</p>
          </div>
          <BaseSwitch v-model="form.authEnabled" label="Auth enabled" :disabled="loading || saving" />
        </div>

        <div class="password-grid">
          <BaseTextField
            v-model="passwords.current"
            label="Current password"
            type="password"
            autocomplete="current-password"
            :disabled="loading || changingPassword"
          />
          <BaseTextField
            v-model="passwords.next"
            label="New password"
            type="password"
            autocomplete="new-password"
            hint="Use at least 8 characters."
            :error="passwordError && !isValidNewPassword(passwords.next) ? passwordError : ''"
            :disabled="loading || changingPassword"
          />
          <BaseTextField
            v-model="passwords.confirm"
            label="Confirm new password"
            type="password"
            autocomplete="new-password"
            :error="passwordError && isValidNewPassword(passwords.next) ? passwordError : ''"
            :disabled="loading || changingPassword"
          />
          <div class="field-action">
            <BaseButton :loading="changingPassword" :disabled="loading || !canChangePassword" @click="submitPassword">
              Change password
            </BaseButton>
          </div>
        </div>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>Access control</template>
      <div class="settings-grid">
        <div class="setting-row">
          <div>
            <h3>Admin user</h3>
            <p>Upstream exposes one server-side admin account and no separate role or permission matrix.</p>
          </div>
          <BaseBadge variant="primary">Parity: single admin</BaseBadge>
        </div>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>Logging</template>
      <div class="settings-grid settings-grid--two">
        <div class="logging-panel">
          <div class="setting-row setting-row--compact">
            <div>
              <h3>Gateway logs</h3>
              <p>Controls app and gateway logging.</p>
            </div>
            <BaseSwitch v-model="form.gatewayLogEnabled" label="Enabled" :disabled="loading || saving" />
          </div>
          <BaseSelect
            v-model="form.gatewayLogLevel"
            label="Gateway log level"
            :options="logLevelOptions"
            :disabled="loading || saving || !form.gatewayLogEnabled"
          />
          <BaseSwitch v-model="form.gatewayLogToFile" label="Write gateway logs to file" :disabled="loading || saving" />
        </div>

        <div class="logging-panel">
          <div class="setting-row setting-row--compact">
            <div>
              <h3>Z-Wave driver logs</h3>
              <p>Controls driver log verbosity and file output.</p>
            </div>
            <BaseSwitch v-model="form.zwaveLogEnabled" label="Enabled" :disabled="loading || saving" />
          </div>
          <BaseSelect
            v-model="form.zwaveLogLevel"
            label="Z-Wave log level"
            :options="logLevelOptions"
            :disabled="loading || saving || !form.zwaveLogEnabled"
          />
          <BaseSwitch v-model="form.zwaveLogToFile" label="Write driver logs to file" :disabled="loading || saving" />
        </div>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>Config DB updates</template>
      <div class="settings-grid">
        <div class="setting-row">
          <div>
            <h3>Device config database</h3>
            <p>{{ updateMessage }}</p>
          </div>
          <BaseBadge :variant="updateVersion ? 'warning' : checkedUpdates ? 'success' : 'neutral'">
            {{ updateVersion ? 'Update available' : checkedUpdates ? 'Up to date' : 'Not checked' }}
          </BaseBadge>
        </div>
        <div class="actions__buttons">
          <BaseButton variant="secondary" :loading="checkingUpdates" :disabled="loading || installingUpdate" @click="checkUpdates">
            Check for updates
          </BaseButton>
          <BaseButton :loading="installingUpdate" :disabled="loading || !updateVersion || checkingUpdates" @click="installUpdate">
            Install update
          </BaseButton>
        </div>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>System actions & diagnostics</template>
      <div class="settings-grid">
        <div class="setting-row">
          <div>
            <h3>Restart app and driver</h3>
            <p>The existing connection bootstrap will recover when the backend is available again.</p>
          </div>
          <BaseButton variant="danger" :loading="restarting" :disabled="loading" @click="restartDriver">
            {{ restarting ? 'Reconnecting…' : 'Restart' }}
          </BaseButton>
        </div>
        <div class="link-list">
          <RouterLink :to="{ name: 'settings-backup' }">Backups</RouterLink>
          <RouterLink :to="{ name: 'diagnostics-logs' }">Debug log</RouterLink>
          <RouterLink :to="{ name: 'diagnostics-zniffer' }">Zniffer diagnostics</RouterLink>
        </div>
      </div>
    </BaseCard>

    <footer class="actions">
      <span class="save-status">{{ savedMessage }}</span>
      <div class="actions__buttons">
        <BaseButton variant="secondary" :disabled="loading || saving" @click="loadSystem">Reset</BaseButton>
        <BaseButton type="submit" :loading="saving" :disabled="loading">Save system settings</BaseButton>
      </div>
    </footer>
  </form>
</template>

<style scoped>
.system-settings {
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
  border-radius: var(--r-md);
  font-size: 0.8125rem;
  font-weight: 700;
}
.settings-grid,
.logging-panel {
  display: grid;
  gap: var(--s-5);
}
.version-grid,
.health-grid,
.password-grid {
  display: grid;
  gap: var(--s-3);
}
.info-tile,
.health-row,
.setting-row,
.logging-panel {
  padding: var(--s-4);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
}
.info-tile {
  display: grid;
  gap: var(--s-1);
}
.info-tile span,
.setting-row p {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
.health-row,
.setting-row,
.link-list,
.actions__buttons {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.health-row {
  justify-content: space-between;
}
.health-row span:nth-child(2) {
  flex: 1;
}
.setting-row {
  justify-content: space-between;
}
.setting-row--compact {
  padding: 0;
  background: transparent;
  border: none;
}
.setting-row h3 {
  margin: 0;
  font-size: 0.9375rem;
}
.setting-row p {
  margin: var(--s-1) 0 0;
}
.link-list {
  flex-wrap: wrap;
}
.link-list a {
  color: var(--color-primary-strong);
  font-weight: 700;
  text-decoration: none;
}
.link-list a:hover {
  text-decoration: underline;
}
.field-action {
  display: flex;
  align-items: end;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.actions__buttons {
  flex-wrap: wrap;
}

@media (min-width: 720px) {
  .page-header,
  .actions {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
  .settings-grid--two,
  .version-grid,
  .health-grid,
  .password-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 960px) {
  .version-grid,
  .health-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .password-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  }
}
</style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { zwaveSocket } from '@/api/socket'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseNumberField from '@/components/base/BaseNumberField.vue'
import BaseSelect, { type SelectOption } from '@/components/base/BaseSelect.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import {
  LOG_LEVELS,
  RF_REGIONS,
  fromSettings,
  generateSecurityKey,
  hasZwaveErrors,
  loadZwaveSettings,
  longRangeSecurityKeyFields,
  saveZwaveSettings,
  scanSerialPorts,
  securityKeyFields,
  validateZwaveForm,
  type LongRangeSecurityKeyName,
  type SecurityKeyName,
  type SerialPort,
  type ZwaveFieldErrors,
  type ZwaveSettingsForm,
} from '@/settings/zwave'
import { useControllerStore } from '@/stores/controller'

const form = reactive<ZwaveSettingsForm>(fromSettings({ settings: {} }))
const ports = ref<SerialPort[]>([])
const errors = ref<ZwaveFieldErrors>({})
const loading = ref(false)
const saving = ref(false)
const scanning = ref(false)
const savedAt = ref<Date | null>(null)
const revealKeys = reactive<Record<string, boolean>>({})

const toast = useToast()
const { confirm } = useConfirm()
const controller = useControllerStore()
const { status, controllerStatus, error: controllerError, info } = storeToRefs(controller)

const regionOptions: SelectOption[] = RF_REGIONS.map((region) => ({
  label: region.label,
  value: region.value,
  disabled: 'disabled' in region ? region.disabled : false,
}))
const logLevelOptions: SelectOption[] = LOG_LEVELS.map((level) => ({
  label: level.label,
  value: level.value,
}))

const serialPortOptions = computed<SelectOption[]>(() => {
  const options = ports.value.map((port) => ({
    label: portLabel(port),
    value: port.path,
  }))

  if (form.port && !options.some((option) => option.value === form.port)) {
    options.unshift({ label: `${form.port} (current)`, value: form.port })
  }

  return options
})

const connectionStatusLabel = computed(() => {
  if (controllerError.value) return controllerError.value
  return controllerStatus.value ?? info.value?.status ?? status.value
})
const savedMessage = computed(() =>
  savedAt.value ? `Saved ${savedAt.value.toLocaleTimeString()}` : 'Changes save to the Z-Wave JS UI backend.',
)

function portLabel(port: SerialPort): string {
  const detail = port.friendlyName ?? port.manufacturer ?? port.serialNumber ?? port.pnpId
  return detail ? `${port.path} — ${detail}` : port.path
}

function replaceForm(next: ZwaveSettingsForm) {
  Object.assign(form, next)
  form.securityKeys = { ...next.securityKeys }
  form.securityKeysLongRange = { ...next.securityKeysLongRange }
}

function keyId(group: 'securityKeys' | 'securityKeysLongRange', key: string): string {
  return `${group}.${key}`
}

function toggleReveal(group: 'securityKeys' | 'securityKeysLongRange', key: string) {
  const id = keyId(group, key)
  revealKeys[id] = !revealKeys[id]
}

function keyType(group: 'securityKeys' | 'securityKeysLongRange', key: string): 'text' | 'password' {
  return revealKeys[keyId(group, key)] ? 'text' : 'password'
}

function setSecurityKey(key: SecurityKeyName) {
  form.securityKeys[key] = generateSecurityKey()
}

function setLongRangeSecurityKey(key: LongRangeSecurityKeyName) {
  form.securityKeysLongRange[key] = generateSecurityKey()
}

async function loadSettings() {
  loading.value = true
  try {
    replaceForm(await loadZwaveSettings())
    errors.value = {}
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Unable to load Z-Wave settings.')
  } finally {
    loading.value = false
  }
}

async function scanPorts() {
  scanning.value = true
  try {
    ports.value = await scanSerialPorts()
    toast.success(ports.value.length ? `Found ${ports.value.length} serial ports.` : 'No serial ports found.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Unable to scan serial ports.')
  } finally {
    scanning.value = false
  }
}

async function restartDriver() {
  const result = await zwaveSocket.callApi('restart')
  if (result.success) {
    toast.success(result.message || 'Driver restart requested.')
  } else {
    toast.error(result.message || 'Driver restart failed.')
  }
}

async function saveSettings() {
  const nextErrors = validateZwaveForm(form)
  errors.value = nextErrors
  if (hasZwaveErrors(nextErrors)) {
    toast.error('Fix the highlighted Z-Wave settings before saving.')
    return
  }

  saving.value = true
  try {
    await saveZwaveSettings(form)
    savedAt.value = new Date()
    toast.success('Z-Wave settings saved.')

    const shouldRestart = await confirm({
      title: 'Restart Z-Wave driver?',
      message: 'Some controller settings require a driver restart before they take effect.',
      confirmText: 'Restart driver',
      cancelText: 'Later',
    })
    if (shouldRestart) await restartDriver()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Unable to save Z-Wave settings.')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <form class="zwave-settings" @submit.prevent="saveSettings">
    <header class="page-header">
      <div>
        <p class="page-header__kicker">Z-Wave & controller</p>
        <h2>Configure the Z-Wave driver</h2>
        <p>Choose the controller connection, security keys, RF region, and core driver options.</p>
      </div>
      <div class="status-panel" aria-live="polite">
        <span class="status-panel__label">Connection</span>
        <strong>{{ connectionStatusLabel }}</strong>
      </div>
    </header>

    <BaseCard>
      <template #header>Connection</template>
      <div class="settings-grid">
        <div class="setting-row">
          <div>
            <h3>Z-Wave driver</h3>
            <p>Disable this only when the backend should not connect to a controller.</p>
          </div>
          <BaseSwitch v-model="form.enabled" label="Enabled" :disabled="loading || saving" />
        </div>

        <div class="connection-grid">
          <BaseSelect
            v-model="form.port"
            label="Serial port"
            :options="serialPortOptions"
            placeholder="Scan ports to select"
            hint="Scans local and supported remote serial ports."
            :error="errors.port"
            :disabled="loading || saving || serialPortOptions.length === 0"
          />
          <div class="scan-action">
            <BaseButton variant="secondary" :loading="scanning" :disabled="loading || saving" @click="scanPorts">
              Scan ports
            </BaseButton>
          </div>
        </div>

        <BaseTextField
          v-model="form.port"
          label="Controller path or remote URL"
          placeholder="/dev/ttyUSB0 or tcp://127.0.0.1:5555"
          hint="Use a serial path, tcp://host:port, ws://host:port, or wss://host:port."
          :error="errors.port"
          :disabled="loading || saving"
        />
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>Security keys</template>
      <div class="settings-grid">
        <p class="section-hint">Keys are masked by default and generated locally in the browser.</p>
        <div class="key-grid">
          <div v-for="field in securityKeyFields" :key="field.key" class="key-row">
            <BaseTextField
              v-model="form.securityKeys[field.key]"
              :label="field.label"
              :type="keyType('securityKeys', field.key)"
              autocomplete="off"
              placeholder="32 hex characters"
              :error="errors.securityKeys?.[field.key]"
              :disabled="loading || saving"
            />
            <div class="key-row__actions">
              <BaseButton
                variant="secondary"
                size="sm"
                :disabled="loading || saving"
                @click="toggleReveal('securityKeys', field.key)"
              >
                {{ revealKeys[keyId('securityKeys', field.key)] ? 'Hide' : 'Reveal' }}
              </BaseButton>
              <BaseButton variant="secondary" size="sm" :disabled="loading || saving" @click="setSecurityKey(field.key)">
                Generate
              </BaseButton>
            </div>
          </div>
        </div>

        <AdvancedOnly>
          <div class="key-grid">
            <div v-for="field in longRangeSecurityKeyFields" :key="field.key" class="key-row">
              <BaseTextField
                v-model="form.securityKeysLongRange[field.key]"
                :label="field.label"
                :type="keyType('securityKeysLongRange', field.key)"
                autocomplete="off"
                placeholder="32 hex characters"
                :error="errors.securityKeysLongRange?.[field.key]"
                :disabled="loading || saving"
              />
              <div class="key-row__actions">
                <BaseButton
                  variant="secondary"
                  size="sm"
                  :disabled="loading || saving"
                  @click="toggleReveal('securityKeysLongRange', field.key)"
                >
                  {{ revealKeys[keyId('securityKeysLongRange', field.key)] ? 'Hide' : 'Reveal' }}
                </BaseButton>
                <BaseButton
                  variant="secondary"
                  size="sm"
                  :disabled="loading || saving"
                  @click="setLongRangeSecurityKey(field.key)"
                >
                  Generate
                </BaseButton>
              </div>
            </div>
          </div>
        </AdvancedOnly>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>Region & driver options</template>
      <div class="settings-grid settings-grid--two">
        <BaseSelect
          v-model="form.rfRegion"
          label="RF region"
          :options="regionOptions"
          hint="Changing region requires a driver restart."
          :disabled="loading || saving"
        />
        <BaseSelect
          v-model="form.logLevel"
          label="Driver log level"
          :options="logLevelOptions"
          :disabled="loading || saving"
        />
        <div class="setting-row">
          <div>
            <h3>Soft reset</h3>
            <p>Allow the driver to use controller soft reset when supported.</p>
          </div>
          <BaseSwitch v-model="form.enableSoftReset" label="Soft reset" :disabled="loading || saving" />
        </div>
        <div class="setting-row">
          <div>
            <h3>Z-Wave JS server</h3>
            <p>Expose the driver through the Z-Wave JS WebSocket server.</p>
          </div>
          <BaseSwitch v-model="form.serverEnabled" label="Server" :disabled="loading || saving" />
        </div>
        <BaseNumberField
          v-model="form.serverPort"
          label="Server port"
          :min="1"
          :max="65535"
          :step="1"
          :error="errors.serverPort"
          :disabled="loading || saving || !form.serverEnabled"
        />
        <AdvancedOnly>
          <BaseNumberField
            v-model="form.commandsTimeout"
            label="Commands timeout"
            :min="1"
            :max="3600"
            :step="1"
            unit="seconds"
            :error="errors.commandsTimeout"
            :disabled="loading || saving"
          />
        </AdvancedOnly>
      </div>
    </BaseCard>

    <footer class="actions">
      <span class="save-status">{{ savedMessage }}</span>
      <div class="actions__buttons">
        <BaseButton variant="secondary" :disabled="loading || saving" @click="loadSettings">Reset</BaseButton>
        <BaseButton type="submit" :loading="saving" :disabled="loading">Save Z-Wave settings</BaseButton>
      </div>
    </footer>
  </form>
</template>

<style scoped>
.zwave-settings {
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
.page-header p,
.section-hint {
  margin: var(--s-2) 0 0;
  color: var(--color-text-muted);
}
.status-panel,
.save-status {
  padding: var(--s-2) var(--s-3);
  color: var(--color-primary-strong);
  background: var(--color-primary-soft);
  border-radius: var(--r-md);
}
.status-panel {
  display: grid;
  gap: var(--s-1);
  align-self: flex-start;
}
.status-panel__label {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.settings-grid {
  display: grid;
  gap: var(--s-5);
}
.connection-grid {
  display: grid;
  gap: var(--s-3);
}
.scan-action {
  display: flex;
  align-items: end;
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
.key-grid {
  display: grid;
  gap: var(--s-4);
}
.key-row {
  display: grid;
  gap: var(--s-3);
}
.key-row__actions,
.actions,
.actions__buttons {
  display: flex;
  gap: var(--s-3);
}
.key-row__actions {
  align-items: end;
}
.actions {
  flex-direction: column;
}
.actions__buttons {
  flex-wrap: wrap;
}
.save-status {
  align-self: flex-start;
  font-size: 0.8125rem;
  font-weight: 700;
}

@media (min-width: 720px) {
  .page-header,
  .actions {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
  .settings-grid--two,
  .connection-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .key-row {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }
}
</style>

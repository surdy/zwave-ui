<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseNumberField from '@/components/base/BaseNumberField.vue'
import BaseSelect, { type SelectOption } from '@/components/base/BaseSelect.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { getSettings, updateSettings } from '@/settings/settingsApi'
import {
  addDevice,
  deleteDevice,
  disableNodeDiscovery,
  discoverDevice,
  fromSettings,
  gatewayTypeLabels,
  GATEWAY_TYPE,
  isValidHost,
  isValidPort,
  isValidPrefix,
  payloadTypeLabels,
  PAYLOAD_TYPE,
  rediscoverNode,
  toSettingsPatch,
  updateDevice,
  type IntegrationsForm,
} from '@/settings/integrations'
import { useNodesStore } from '@/stores/nodes'

type FieldErrors = Partial<Record<'host' | 'port' | 'mqttPrefix' | 'discoveryPrefix' | 'deviceJson', string>>

const toast = useToast()
const { confirm } = useConfirm()
const nodesStore = useNodesStore()
const { devices } = storeToRefs(nodesStore)

const form = ref<IntegrationsForm>(fromSettings({}))
const loading = ref(false)
const saving = ref(false)
const errors = ref<FieldErrors>({})
const selectedNodeId = ref<string | number>('')
const selectedDeviceId = ref<string | number>('')
const deviceJson = ref('')
const actionBusy = ref<string | null>(null)

const gatewayTypeOptions: SelectOption[] = Object.values(GATEWAY_TYPE).map((value) => ({
  label: gatewayTypeLabels[value],
  value,
}))
const payloadTypeOptions: SelectOption[] = Object.values(PAYLOAD_TYPE).map((value) => ({
  label: payloadTypeLabels[value],
  value,
}))
const qosOptions: SelectOption[] = [
  { label: '0 - At most once', value: 0 },
  { label: '1 - At least once', value: 1 },
  { label: '2 - Exactly once', value: 2 },
]
const logLevelOptions: SelectOption[] = ['error', 'warn', 'info', 'debug', 'silly'].map((value) => ({
  label: value,
  value,
}))

const nodeOptions = computed<SelectOption[]>(() =>
  devices.value.map((node) => ({
    label: `${node.id}: ${node.name || node.productLabel || 'Unnamed node'}`,
    value: node.id,
  })),
)

const selectedNode = computed(() => {
  const id = Number(selectedNodeId.value)
  return Number.isFinite(id) ? nodesStore.getNode(id) : undefined
})

const hassDevices = computed<Record<string, unknown>>(() => {
  const raw = selectedNode.value?.hassDevices
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
})

const deviceOptions = computed<SelectOption[]>(() =>
  Object.entries(hassDevices.value).map(([id, device]) => ({ label: deviceLabel(id, device), value: id })),
)

const selectedDevice = computed(() => {
  const id = String(selectedDeviceId.value)
  return id ? hassDevices.value[id] : undefined
})

const mqttStatus = computed(() => {
  if (!form.value.mqtt.enabled) return { label: 'Disabled', status: 'idle' as const }
  return { label: 'Status not reported by this frontend store', status: 'idle' as const }
})

function deviceLabel(id: string, device: unknown): string {
  if (device && typeof device === 'object') {
    const record = device as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name : undefined
    const type = typeof record.type === 'string' ? record.type : undefined
    return [id, name, type].filter(Boolean).join(' · ')
  }
  return id
}

function validate(): boolean {
  const next: FieldErrors = {}
  if (form.value.mqtt.enabled) {
    if (!isValidHost(form.value.mqtt.host)) next.host = 'Enter a broker host without spaces.'
    if (!isValidPort(form.value.mqtt.port)) next.port = 'Enter a port from 1 to 65535.'
    if (!isValidPrefix(form.value.mqtt.prefix)) next.mqttPrefix = 'Use a non-empty topic prefix without spaces.'
  }
  if (form.value.gateway.hassDiscovery && !isValidPrefix(form.value.gateway.discoveryPrefix)) {
    next.discoveryPrefix = 'Use a non-empty discovery prefix without spaces.'
  }
  errors.value = next
  return Object.keys(next).length === 0
}

async function loadSettings() {
  loading.value = true
  try {
    form.value = fromSettings(await getSettings())
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to load integration settings')
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  if (!validate()) {
    toast.error('Fix validation errors before saving.')
    return
  }
  saving.value = true
  try {
    await updateSettings(toSettingsPatch(form.value))
    toast.success('Integration settings saved')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to save integration settings')
  } finally {
    saving.value = false
  }
}

async function runNodeAction(kind: 'rediscover' | 'disable') {
  const nodeId = Number(selectedNodeId.value)
  if (!Number.isFinite(nodeId)) return

  const confirmed =
    kind === 'rediscover'
      ? await confirm({
          title: 'Rediscover node?',
          message: `Re-write Home Assistant discovery for node ${nodeId}.`,
          confirmText: 'Rediscover',
        })
      : await confirm({
          title: 'Disable discovery?',
          message: `Disable Home Assistant discovery for all values on node ${nodeId}. Store settings afterward to persist upstream changes.`,
          confirmText: 'Disable',
          danger: true,
        })
  if (!confirmed) return

  await runHassAction(kind, () =>
    kind === 'rediscover' ? rediscoverNode(nodeId) : disableNodeDiscovery(nodeId),
  )
}

async function runDeviceAction(kind: 'discover' | 'delete' | 'add' | 'update') {
  const nodeId = Number(selectedNodeId.value)
  if (!Number.isFinite(nodeId)) return
  errors.value = { ...errors.value, deviceJson: undefined }

  const parsed = parseDeviceJson()
  if (parsed === undefined) return

  if (
    (kind === 'delete' || kind === 'discover') &&
    !selectedDevice.value &&
    !(await confirm({ title: 'Use JSON device?', message: 'No stored device is selected; use the JSON payload?' }))
  ) {
    return
  }

  if (
    kind === 'delete' &&
    !(await confirm({
      title: 'Delete discovery device?',
      message: 'Delete the selected Home Assistant discovery device.',
      confirmText: 'Delete',
      danger: true,
    }))
  ) {
    return
  }

  const device = kind === 'add' || kind === 'update' ? parsed : (selectedDevice.value ?? parsed)
  const runner = {
    discover: () => discoverDevice(nodeId, device),
    delete: () => deleteDevice(nodeId, device),
    add: () => addDevice(nodeId, device),
    update: () => updateDevice(nodeId, device),
  }[kind]
  await runHassAction(kind, runner)
}

function parseDeviceJson(): unknown | undefined {
  try {
    return JSON.parse(deviceJson.value || '{}')
  } catch {
    errors.value = { ...errors.value, deviceJson: 'Enter valid JSON for the Home Assistant device.' }
    return undefined
  }
}

async function runHassAction(label: string, runner: () => Promise<{ success: boolean; message: string }>) {
  actionBusy.value = label
  try {
    const result = await runner()
    if (result.success) toast.success(result.message || `Home Assistant ${label} completed`)
    else toast.error(result.message || `Home Assistant ${label} failed`)
  } finally {
    actionBusy.value = null
  }
}

watch(selectedNodeId, () => {
  selectedDeviceId.value = ''
  deviceJson.value = ''
})

watch(selectedDevice, (device) => {
  deviceJson.value = device ? JSON.stringify(device, null, 2) : ''
})

onMounted(loadSettings)
</script>

<template>
  <div class="integrations-settings">
    <header class="page-header">
      <div>
        <p class="page-header__kicker">Integrations</p>
        <h2>MQTT gateway & Home Assistant</h2>
        <p>Configure broker publishing, gateway topics, and Home Assistant discovery.</p>
      </div>
      <BaseButton :loading="saving" :disabled="loading" @click="saveSettings">Save integrations</BaseButton>
    </header>

    <BaseCard>
      <template #header>
        <div class="card-title">
          <span>MQTT</span>
          <span class="status-pill">
            <StatusDot :status="mqttStatus.status" :label="mqttStatus.label" />
            {{ mqttStatus.label }}
          </span>
        </div>
      </template>
      <div class="settings-grid settings-grid--two">
        <div class="setting-row">
          <div>
            <h3>MQTT gateway</h3>
            <p>Enable broker publishing and subscriptions.</p>
          </div>
          <BaseSwitch v-model="form.mqtt.enabled" label="Enabled" />
        </div>
        <BaseTextField v-model="form.mqtt.host" label="Broker host" :error="errors.host" />
        <BaseNumberField v-model="form.mqtt.port" label="Port" :min="1" :max="65535" :error="errors.port" />
        <BaseTextField v-model="form.mqtt.name" label="Client name" />
        <BaseTextField v-model="form.mqtt.prefix" label="Topic prefix" :error="errors.mqttPrefix" />
        <BaseSelect v-model="form.mqtt.qos" label="QoS" :options="qosOptions" />
        <BaseNumberField
          v-model="form.mqtt.reconnectPeriod"
          label="Reconnect period"
          :min="0"
          unit="ms"
        />
        <div class="setting-row">
          <div>
            <h3>Authentication</h3>
            <p>Use a username and masked password for the broker.</p>
          </div>
          <BaseSwitch v-model="form.mqtt.auth" label="Auth" />
        </div>
        <BaseTextField v-model="form.mqtt.username" label="Username" autocomplete="username" />
        <BaseTextField
          v-model="form.mqtt.password"
          label="Password"
          type="password"
          autocomplete="current-password"
        />
        <div class="switch-list">
          <BaseSwitch v-model="form.mqtt.retain" label="Retain published messages" />
          <BaseSwitch v-model="form.mqtt.clean" label="Clean session" />
          <BaseSwitch v-model="form.mqtt.store" label="Persist outgoing messages" />
        </div>
        <AdvancedOnly>
          <div class="switch-list">
            <BaseSwitch v-model="form.mqtt.allowSelfsigned" label="Allow self-signed TLS certificates" />
          </div>
          <BaseTextField v-model="form.mqtt.ca" label="CA path" />
          <BaseTextField v-model="form.mqtt.cert" label="Certificate path" />
          <BaseTextField v-model="form.mqtt.key" label="Private key path" />
        </AdvancedOnly>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>Gateway topics</template>
      <div class="settings-grid settings-grid--two">
        <BaseSelect v-model="form.gateway.type" label="Gateway type" :options="gatewayTypeOptions" />
        <BaseSelect v-model="form.gateway.payloadType" label="Payload type" :options="payloadTypeOptions" />
        <div class="switch-list">
          <BaseSwitch v-model="form.gateway.nodeNames" label="Use node names in topics" />
          <BaseSwitch v-model="form.gateway.ignoreLoc" label="Ignore node location in topics" />
          <BaseSwitch v-model="form.gateway.sendEvents" label="Send node events" />
          <BaseSwitch v-model="form.gateway.includeNodeInfo" label="Include node info" />
        </div>
        <div class="switch-list">
          <BaseSwitch v-model="form.gateway.ignoreStatus" label="Ignore status topics" />
          <BaseSwitch v-model="form.gateway.publishNodeDetails" label="Publish node details" />
          <BaseSwitch v-model="form.gateway.retainedDiscovery" label="Retain discovery payloads" />
        </div>
        <AdvancedOnly>
          <BaseTextField
            v-model="form.gateway.entityTemplate"
            label="Entity template"
            hint="Optional upstream Home Assistant entity template."
          />
          <div class="switch-list">
            <BaseSwitch
              v-model="form.gateway.useLocationAsSuggestedArea"
              label="Use location as suggested area"
            />
            <BaseSwitch v-model="form.gateway.manualDiscovery" label="Manual discovery" />
            <BaseSwitch v-model="form.gateway.logEnabled" label="Gateway logging" />
            <BaseSwitch v-model="form.gateway.logToFile" label="Log gateway output to file" />
          </div>
          <BaseSelect v-model="form.gateway.logLevel" label="Gateway log level" :options="logLevelOptions" />
        </AdvancedOnly>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>Home Assistant</template>
      <div class="settings-grid">
        <div class="settings-grid settings-grid--two">
          <div class="setting-row">
            <div>
              <h3>Discovery</h3>
              <p>Publish Home Assistant MQTT discovery payloads.</p>
            </div>
            <BaseSwitch v-model="form.gateway.hassDiscovery" label="Enabled" />
          </div>
          <BaseTextField
            v-model="form.gateway.discoveryPrefix"
            label="Discovery prefix"
            :error="errors.discoveryPrefix"
          />
        </div>

        <div class="ha-actions">
          <BaseSelect
            v-model="selectedNodeId"
            label="Node"
            :options="nodeOptions"
            placeholder="Select a node"
            :disabled="nodeOptions.length === 0"
          />
          <div class="button-row">
            <BaseButton
              variant="secondary"
              :disabled="!selectedNodeId || actionBusy !== null"
              :loading="actionBusy === 'rediscover'"
              @click="runNodeAction('rediscover')"
            >
              Rediscover node
            </BaseButton>
            <BaseButton
              variant="danger"
              :disabled="!selectedNodeId || actionBusy !== null"
              :loading="actionBusy === 'disable'"
              @click="runNodeAction('disable')"
            >
              Disable discovery
            </BaseButton>
          </div>

          <BaseSelect
            v-model="selectedDeviceId"
            label="Home Assistant device"
            :options="deviceOptions"
            placeholder="Select a device"
            :disabled="deviceOptions.length === 0"
            hint="Devices are available when the selected node has Home Assistant discovery metadata."
          />
          <div class="button-row">
            <BaseButton
              variant="secondary"
              :disabled="!selectedNodeId || actionBusy !== null"
              :loading="actionBusy === 'discover'"
              @click="runDeviceAction('discover')"
            >
              Rediscover device
            </BaseButton>
            <BaseButton
              variant="danger"
              :disabled="!selectedNodeId || actionBusy !== null"
              :loading="actionBusy === 'delete'"
              @click="runDeviceAction('delete')"
            >
              Delete device discovery
            </BaseButton>
          </div>

          <AdvancedOnly>
            <label class="json-field">
              <span>Device JSON</span>
              <textarea v-model="deviceJson" rows="8" spellcheck="false" />
              <small :class="{ 'json-field__error': errors.deviceJson }">
                {{ errors.deviceJson || 'Edit a selected device or paste JSON for add/update actions.' }}
              </small>
            </label>
            <div class="button-row">
              <BaseButton
                variant="secondary"
                :disabled="!selectedNodeId || actionBusy !== null"
                :loading="actionBusy === 'add'"
                @click="runDeviceAction('add')"
              >
                Add device
              </BaseButton>
              <BaseButton
                variant="secondary"
                :disabled="!selectedNodeId || actionBusy !== null"
                :loading="actionBusy === 'update'"
                @click="runDeviceAction('update')"
              >
                Update device
              </BaseButton>
            </div>
          </AdvancedOnly>
        </div>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.integrations-settings {
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
}
.page-header,
.card-title {
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
.switch-list,
.ha-actions {
  display: grid;
  gap: var(--s-3);
}
.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
}
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  width: fit-content;
  padding: var(--s-2) var(--s-3);
  color: var(--color-text-muted);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--r-pill);
  font-size: 0.8125rem;
}
.json-field {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  font-size: 0.875rem;
  font-weight: 600;
}
.json-field textarea {
  width: 100%;
  padding: var(--s-3);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  font: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  resize: vertical;
}
.json-field textarea:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}
.json-field small {
  color: var(--color-text-muted);
  font-weight: 400;
}
.json-field__error {
  color: var(--danger) !important;
}

@media (min-width: 720px) {
  .page-header,
  .card-title {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
  .settings-grid--two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

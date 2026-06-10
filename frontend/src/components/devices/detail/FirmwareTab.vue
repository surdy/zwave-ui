<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Channel, SocketEvent, type ZwaveNode, zwaveSocket } from '@/api'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import {
  abortFirmwareUpdate,
  canStartUpdate,
  dismissFirmwareUpdate,
  firmwareReducer,
  firmwareUpdateOTA,
  getAvailableFirmwareUpdates,
  getNodeFirmwareUpdates,
  initialFirmwareState,
  parseUpdateResult,
  updateFirmware,
  type FirmwareProgress,
  type FirmwareState,
  type FirmwareUpdateInfo,
  type ManualFirmwareFile,
} from '@/devices/firmware'

const props = defineProps<{ node: ZwaveNode }>()

const toast = useToast()
const { confirm } = useConfirm()
const state = ref<FirmwareState>(initialFirmwareState())
const updates = ref<FirmwareUpdateInfo[]>([])
const selectedVersion = ref('')
const manualFiles = ref<File[]>([])
const manualTarget = ref('')
const busy = ref(false)

const selectedUpdate = computed(() => updates.value.find((update) => update.version === selectedVersion.value))
const updateOptions = computed(() =>
  updates.value.map((update) => ({
    label: `${update.version}${update.channel ? ` · ${update.channel}` : ''}${update.downgrade ? ' · downgrade' : ''}`,
    value: update.version,
  })),
)
const startEnabled = computed(() => canStartUpdate(state.value, props.node))
const isUpdating = computed(() => state.value.phase === 'updating')
const availabilityWarning = computed(() => {
  if (props.node.failed || props.node.status === 'Dead') return 'This node is failed/dead. Firmware updates are blocked until it is healthy.'
  if (!props.node.available || !props.node.ready) return 'This node is not currently available. Firmware updates are blocked.'
  if (props.node.status === 'Asleep') return 'This device is asleep. Wake it before starting a firmware update.'
  return ''
})
const resultVariant = computed(() => {
  if (state.value.phase === 'success') return 'success'
  if (state.value.phase === 'error') return 'danger'
  if (state.value.phase === 'aborted') return 'warning'
  return 'neutral'
})
const phaseDot = computed(() => {
  if (state.value.phase === 'success') return 'ok'
  if (state.value.phase === 'error') return 'danger'
  if (state.value.phase === 'updating' || state.value.phase === 'checking') return 'info'
  return 'idle'
})

watch(
  () => props.node.firmwareUpdate,
  (progress) => {
    if (progress && typeof progress === 'object') {
      state.value = firmwareReducer(state.value, { type: 'progress', progress: progress as FirmwareProgress })
    } else if (progress === false && state.value.phase === 'updating') {
      const result = parseUpdateResult({ success: true, message: 'Firmware update finished. Re-interview may be required.' })
      state.value = firmwareReducer(state.value, { type: 'success', result })
    }
  },
  { immediate: true },
)

watch(
  () => props.node.availableFirmwareUpdates,
  (nodeUpdates) => {
    if (Array.isArray(nodeUpdates) && updates.value.length === 0) setUpdates(nodeUpdates as FirmwareUpdateInfo[])
  },
  { immediate: true },
)

onMounted(() => {
  zwaveSocket.subscribe([Channel.firmware])
  zwaveSocket.on(SocketEvent.otwFirmwareUpdate, handleFirmwareEvent)
  void checkUpdates()
})

onBeforeUnmount(() => {
  zwaveSocket.off(SocketEvent.otwFirmwareUpdate, handleFirmwareEvent)
  zwaveSocket.unsubscribe([Channel.firmware])
})

async function checkUpdates() {
  if (busy.value || isUpdating.value) return
  busy.value = true
  state.value = firmwareReducer(state.value, { type: 'check' })
  try {
    const [nodeUpdates, onlineUpdates] = await Promise.all([
      getNodeFirmwareUpdates(props.node.id),
      getAvailableFirmwareUpdates(props.node.id),
    ])
    if (!nodeUpdates.success && !onlineUpdates.success) {
      throw new Error(nodeUpdates.message || onlineUpdates.message || 'Could not check firmware updates')
    }
    setUpdates(mergeUpdates(nodeUpdates.result, onlineUpdates.result))
    state.value = firmwareReducer(state.value, { type: 'available', updates: updates.value })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not check firmware updates'
    state.value = firmwareReducer(state.value, { type: 'error', error: message })
    toast.error(message)
  } finally {
    busy.value = false
  }
}

async function startOtaUpdate() {
  const update = selectedUpdate.value
  if (!update) return toast.warning('Select a firmware update first.')
  if (!startEnabled.value) return toast.warning(availabilityWarning.value || 'Firmware update cannot be started now.')
  if (!(await confirmUpdate(`Install firmware ${update.version} on node ${props.node.id}?`))) return

  state.value = firmwareReducer(state.value, { type: 'start' })
  busy.value = true
  try {
    const response = await firmwareUpdateOTA(props.node.id, update)
    const result = parseUpdateResult(response)
    state.value = firmwareReducer(state.value, result.success ? { type: 'success', result } : { type: 'error', error: result.message })
    if (result.success) toast.success('Firmware update completed')
    else toast.error(result.message)
  } catch (error) {
    failUpdate(error)
  } finally {
    busy.value = false
  }
}

async function startManualUpdate() {
  if (manualFiles.value.length === 0) return toast.warning('Choose at least one firmware file.')
  if (!startEnabled.value) return toast.warning(availabilityWarning.value || 'Firmware update cannot be started now.')
  if (!(await confirmUpdate(`Upload ${manualFiles.value.length} firmware file(s) to node ${props.node.id}?`))) return

  state.value = firmwareReducer(state.value, { type: 'start' })
  busy.value = true
  try {
    const files = await readManualFiles()
    const response = await updateFirmware(props.node.id, files)
    const result = parseUpdateResult(response)
    state.value = firmwareReducer(state.value, result.success ? { type: 'success', result } : { type: 'error', error: result.message })
    if (result.success) toast.success('Firmware update completed')
    else toast.error(result.message)
  } catch (error) {
    failUpdate(error)
  } finally {
    busy.value = false
  }
}

async function abortUpdate() {
  if (!(await confirm({ danger: true, title: 'Abort firmware update?', message: 'Abort only if the update is stalled or unsafe to continue.' }))) return
  busy.value = true
  try {
    const response = await abortFirmwareUpdate(props.node.id)
    if (!response.success) throw new Error(response.message || 'Could not abort firmware update')
    state.value = firmwareReducer(state.value, { type: 'aborted' })
    toast.warning('Firmware update aborted')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not abort firmware update')
  } finally {
    busy.value = false
  }
}

async function dismissUpdate(update: FirmwareUpdateInfo) {
  const response = await dismissFirmwareUpdate(props.node.id, update.version)
  if (!response.success) return toast.error(response.message || 'Could not dismiss firmware update')
  setUpdates(updates.value.filter((item) => item.version !== update.version))
  state.value = firmwareReducer(state.value, { type: 'available', updates: updates.value })
  toast.info(`Dismissed firmware ${update.version}`)
}

function onFilesChanged(event: Event) {
  const input = event.target as HTMLInputElement
  manualFiles.value = Array.from(input.files ?? [])
}

function handleFirmwareEvent(payload: unknown) {
  const event = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  if (event.progress && typeof event.progress === 'object') {
    state.value = firmwareReducer(state.value, { type: 'progress', progress: event.progress as FirmwareProgress })
  }
  if (event.result) {
    const result = parseUpdateResult(event.result)
    state.value = firmwareReducer(state.value, result.success ? { type: 'success', result } : { type: 'error', error: result.message })
  }
}

function setUpdates(next: FirmwareUpdateInfo[]) {
  updates.value = next.filter((update) => !isDismissed(update))
  selectedVersion.value = updates.value[0]?.version ?? ''
}

function mergeUpdates(...lists: (FirmwareUpdateInfo[] | undefined)[]): FirmwareUpdateInfo[] {
  const map = new Map<string, FirmwareUpdateInfo>()
  for (const update of lists.flatMap((list) => list ?? [])) map.set(update.version, update)
  return [...map.values()]
}

async function readManualFiles(): Promise<ManualFirmwareFile[]> {
  const target = manualTarget.value === '' ? undefined : Number(manualTarget.value)
  return Promise.all(
    manualFiles.value.map(async (file) => ({
      name: file.name,
      data: new Uint8Array(await file.arrayBuffer()),
      target: Number.isFinite(target) ? target : undefined,
    })),
  )
}

async function confirmUpdate(message: string): Promise<boolean> {
  return confirm({
    danger: true,
    title: 'Update firmware?',
    message: `${message} Do not power off the device, controller, or host during the update. A failed update can brick the device and a re-interview may be required.`,
    confirmText: 'Start update',
  })
}

function failUpdate(error: unknown) {
  const message = error instanceof Error ? error.message : 'Firmware update failed'
  state.value = firmwareReducer(state.value, { type: 'error', error: message })
  toast.error(message)
}

function firmwareLabel(update: FirmwareUpdateInfo): string {
  return [update.version, update.channel, update.downgrade ? 'downgrade' : ''].filter(Boolean).join(' · ')
}

function isDismissed(update: FirmwareUpdateInfo): boolean {
  const dismissed = props.node.firmwareUpdatesDismissed
  if (!dismissed || typeof dismissed !== 'object') return false
  return (dismissed as Record<string, unknown>)[update.version] === true
}
</script>

<template>
  <section class="firmware tabpanel">
    <header class="firmware__hero card">
      <div>
        <div class="firmware__title">
          <h2>Firmware</h2>
          <BaseBadge variant="expert">Expert</BaseBadge>
        </div>
        <p class="muted">Firmware updates are destructive operations. Confirm the exact device and keep it powered throughout the update.</p>
      </div>
      <BaseButton variant="secondary" :loading="busy && state.phase === 'checking'" :disabled="isUpdating" @click="checkUpdates">Check updates</BaseButton>
    </header>

    <article v-if="availabilityWarning" class="warning card">
      <BaseBadge variant="warning"><StatusDot status="info" /> Availability</BaseBadge>
      <p>{{ availabilityWarning }}</p>
    </article>

    <article class="card facts">
      <h3>Current firmware & fingerprint</h3>
      <dl>
        <div><dt>Firmware</dt><dd>{{ node.firmwareVersion || 'Unknown' }}</dd></div>
        <div><dt>Manufacturer ID</dt><dd>{{ node.manufacturerId ?? 'Unknown' }}</dd></div>
        <div><dt>Product type</dt><dd>{{ node.productType ?? 'Unknown' }}</dd></div>
        <div><dt>Product ID</dt><dd>{{ node.productId ?? 'Unknown' }}</dd></div>
      </dl>
    </article>

    <article class="card progress-card">
      <div class="progress-card__top">
        <BaseBadge :variant="resultVariant"><StatusDot :status="phaseDot" /> {{ state.phase }}</BaseBadge>
        <BaseButton v-if="isUpdating" variant="danger" :loading="busy" @click="abortUpdate">Abort</BaseButton>
      </div>
      <progress class="progress" max="100" :value="state.percent">{{ state.percent }}%</progress>
      <p>{{ state.status }} <strong v-if="isUpdating">{{ state.percent }}%</strong></p>
      <p v-if="state.result?.reInterview" class="muted">The device reported that a re-interview may be required.</p>
      <p v-if="state.result?.waitTime" class="muted">Wait {{ state.result.waitTime }}s before interacting with the device.</p>
    </article>

    <article class="card update-card">
      <div class="section-head">
        <div>
          <h3>Online updates</h3>
          <p class="muted">Updates from the firmware update service for this device fingerprint.</p>
        </div>
      </div>

      <EmptyState v-if="updates.length === 0" icon="✅" title="No online updates" description="Check again later or use a vendor-provided firmware file." />
      <template v-else>
        <BaseSelect v-model="selectedVersion" label="Available update" :options="updateOptions" :disabled="isUpdating" />
        <div v-for="update in updates" :key="update.version" class="update">
          <div class="update__head">
            <strong>{{ firmwareLabel(update) }}</strong>
            <div class="button-pair">
              <BaseButton size="sm" variant="ghost" :disabled="isUpdating" @click="dismissUpdate(update)">Dismiss</BaseButton>
            </div>
          </div>
          <p class="muted">Files: {{ update.files?.length ?? 0 }}</p>
          <pre v-if="update.changelog" class="changelog">{{ update.changelog }}</pre>
          <p v-else class="muted">No changelog provided.</p>
        </div>
        <BaseButton variant="danger" :disabled="!selectedUpdate || !startEnabled || busy" :loading="busy && isUpdating" @click="startOtaUpdate">
          Start OTA update
        </BaseButton>
      </template>
    </article>

    <article class="card update-card">
      <h3>Manual update</h3>
      <p class="muted">Upload vendor firmware file(s). Only use files intended for the fingerprint above.</p>
      <label class="file-field">
        <span>Firmware file(s)</span>
        <input type="file" multiple :disabled="isUpdating" @change="onFilesChanged">
      </label>
      <label class="file-field">
        <span>Target (optional)</span>
        <input v-model="manualTarget" class="input" type="number" min="0" placeholder="Default target" :disabled="isUpdating">
      </label>
      <p v-if="manualFiles.length" class="muted">{{ manualFiles.length }} file(s) selected: {{ manualFiles.map((file) => file.name).join(', ') }}</p>
      <BaseButton variant="danger" :disabled="manualFiles.length === 0 || !startEnabled || busy" :loading="busy && isUpdating" @click="startManualUpdate">
        Start manual update
      </BaseButton>
    </article>
  </section>
</template>

<style scoped>
.tabpanel,
.firmware,
.update-card,
.progress-card {
  display: grid;
  gap: var(--s-4);
}
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-1);
  padding: var(--s-5);
}
.firmware__hero,
.section-head,
.progress-card__top,
.update__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--s-3);
}
.firmware__title,
.button-pair {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
}
h2,
h3,
p {
  margin: 0;
}
.muted {
  color: var(--color-text-muted);
}
.warning {
  display: grid;
  gap: var(--s-2);
  border-color: var(--warn);
  background: var(--warn-soft);
}
.facts dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: var(--s-4);
  margin: var(--s-4) 0 0;
}
.facts dt {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.facts dd {
  margin: var(--s-1) 0 0;
  font-weight: 600;
}
.progress {
  width: 100%;
  height: var(--s-3);
  accent-color: var(--color-primary);
}
.update {
  display: grid;
  gap: var(--s-2);
  padding-top: var(--s-4);
  border-top: 1px solid var(--color-border);
}
.changelog {
  max-height: 14rem;
  overflow: auto;
  white-space: pre-wrap;
  color: var(--color-text);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  padding: var(--s-3);
  margin: 0;
}
.file-field {
  display: grid;
  gap: var(--s-2);
  font-weight: 600;
}
.file-field input {
  font: inherit;
  color: var(--color-text);
}
.input {
  width: 100%;
  padding: var(--s-3);
  font: inherit;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
}
@media (max-width: 720px) {
  .firmware__hero,
  .section-head,
  .progress-card__top,
  .update__head {
    flex-direction: column;
  }
}
</style>

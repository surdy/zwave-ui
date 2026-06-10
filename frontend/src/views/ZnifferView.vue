<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Channel, SocketEvent } from '@/api/events'
import { zwaveSocket } from '@/api/socket'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import { useToast } from '@/composables/useToast'
import {
  appendFrames,
  computeWindow,
  filterFrames,
  formatFrameSummary,
  framesToBlob,
  parseFrequencyOptions,
  payloadToHex,
  saveCapture,
  setFrequency,
  znifferClear,
  znifferGetFrames,
  znifferStart,
  znifferStop,
  type FrequencyOption,
  type ZnifferFrame,
  type ZnifferState,
} from '@/diagnostics/zniffer'
import { getSettings, updateSettings, type ZwaveUiSettings } from '@/settings/settingsApi'

const MAX_FRAMES = 5000
const ROW_HEIGHT = 40
const OVERSCAN = 8

type PendingAction = 'start' | 'stop' | 'clear' | 'frequency' | 'save' | 'settings' | 'frames' | null

interface ZnifferSettings {
  port?: string
  enabled?: boolean
  region?: string | number
  frequency?: number
  [key: string]: unknown
}

const toast = useToast()
const framesEl = ref<HTMLElement | null>(null)
const frames = ref<ZnifferFrame[]>([])
const state = ref<ZnifferState | null>(null)
const settings = ref<ZnifferSettings>({})
const query = ref('')
const nodeFilter = ref('')
const channelFilter = ref('')
const typeFilter = ref('')
const corruptedOnly = ref(false)
const autoScroll = ref(true)
const scrollTop = ref(0)
const viewportH = ref(520)
const selectedFrame = ref<ZnifferFrame | null>(null)
const selectedFrequency = ref<string | number>('')
const configurePort = ref('')
const configureEnabled = ref(true)
const socketConnected = ref(zwaveSocket.connected)
const pendingAction = ref<PendingAction>(null)

let resizeObserver: ResizeObserver | null = null

const configured = computed(() => Boolean(settings.value.enabled && String(settings.value.port ?? '').trim()))
const running = computed(() => state.value?.started === true)
const frequencyOptions = computed<FrequencyOption[]>(() => parseFrequencyOptions(state.value))
const channelOptions = computed(() => {
  const values = Array.from(new Set(frames.value.map((frame) => frame.channel ?? frame.region).filter((value) => value !== undefined && value !== null)))
  return [{ label: 'All channels', value: '' }, ...values.map((value) => ({ label: String(value), value: String(value) }))]
})
const typeOptions = computed(() => {
  const values = Array.from(new Set(frames.value.map((frame) => frame.type ?? frame.command ?? frame.protocol).filter((value) => value !== undefined && value !== null)))
  return [{ label: 'All types', value: '' }, ...values.map((value) => ({ label: String(value), value: String(value) }))]
})
const filteredFrames = computed(() =>
  filterFrames(frames.value, {
    query: query.value,
    channel: channelFilter.value,
    node: nodeFilter.value,
    type: typeFilter.value,
    corruptedOnly: corruptedOnly.value,
  }),
)
const windowRange = computed(() => computeWindow(scrollTop.value, ROW_HEIGHT, viewportH.value, filteredFrames.value.length, OVERSCAN))
const visibleFrames = computed(() => filteredFrames.value.slice(windowRange.value.start, windowRange.value.end))
const isFiltered = computed(() => query.value.trim() !== '' || nodeFilter.value.trim() !== '' || channelFilter.value !== '' || typeFilter.value !== '' || corruptedOnly.value)
const statusVariant = computed(() => (running.value ? 'success' : configured.value ? 'neutral' : 'warning'))
const statusLabel = computed(() => {
  if (!socketConnected.value) return 'Socket disconnected'
  if (state.value?.error) return state.value.error
  if (!configured.value) return 'Zniffer not configured'
  return running.value ? 'Capturing' : 'Idle'
})
const statusDot = computed(() => {
  if (!socketConnected.value || state.value?.error) return 'danger'
  if (!configured.value) return 'warn'
  return running.value ? 'ok' : 'idle'
})
const currentFrequencyLabel = computed(() => frequencyOptions.value.find((option) => option.value === state.value?.frequency)?.label ?? valueOrDash(state.value?.frequency))
const detailOpen = computed({
  get: () => selectedFrame.value !== null,
  set: (open: boolean) => {
    if (!open) selectedFrame.value = null
  },
})
const detailEntries = computed(() => Object.entries(selectedFrame.value ?? {}).map(([key, value]) => ({ key, value: formatDetailValue(value) })))
const emptyTitle = computed(() => (frames.value.length === 0 ? 'No Zniffer frames yet' : 'No matching frames'))
const emptyDescription = computed(() => (frames.value.length === 0 ? 'Start capture or wait for live ZNIFFER_FRAME events.' : 'Try changing the node, channel, corrupted, or text filters.'))

function handleFrame(payload: unknown) {
  if (!isFrame(payload)) return
  frames.value = appendFrames(frames.value, [payload], MAX_FRAMES)
  if (autoScroll.value) void scrollToBottom()
}

function handleState(payload: unknown) {
  if (!isRecord(payload)) return
  state.value = payload as ZnifferState
}

function handleConnect() {
  socketConnected.value = true
  zwaveSocket.subscribe([Channel.znifferFrames, Channel.znifferState])
}

function handleDisconnect() {
  socketConnected.value = false
}

function updateViewport() {
  if (!framesEl.value) return
  viewportH.value = framesEl.value.clientHeight || viewportH.value
}

function onScroll(event: Event) {
  const target = event.currentTarget as HTMLElement
  scrollTop.value = target.scrollTop
  viewportH.value = target.clientHeight || viewportH.value
  const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight
  if (distanceFromBottom > ROW_HEIGHT * 4) autoScroll.value = false
}

async function scrollToBottom() {
  await nextTick()
  if (!framesEl.value) return
  updateViewport()
  framesEl.value.scrollTop = framesEl.value.scrollHeight
  scrollTop.value = framesEl.value.scrollTop
}

async function loadSettings() {
  pendingAction.value = 'settings'
  try {
    const response = await getSettings()
    const nextSettings = settingsFrom(response.settings)
    settings.value = nextSettings
    configurePort.value = String(nextSettings.port ?? '')
    configureEnabled.value = nextSettings.enabled ?? true
  } catch {
    toast.error('Could not load Zniffer settings')
  } finally {
    pendingAction.value = null
  }
}

async function loadCapturedFrames() {
  pendingAction.value = 'frames'
  try {
    const response = await znifferGetFrames()
    if (!response.success) throw new Error(response.message || 'Could not load captured frames')
    if (Array.isArray(response.result)) frames.value = appendFrames([], response.result, MAX_FRAMES)
  } catch (error) {
    toast.warning(messageFrom(error))
  } finally {
    pendingAction.value = null
  }
}

async function runControl(action: Exclude<PendingAction, 'frequency' | 'save' | 'settings' | 'frames' | null>) {
  pendingAction.value = action
  try {
    const response = action === 'start' ? await znifferStart() : action === 'stop' ? await znifferStop() : await znifferClear()
    if (!response.success) throw new Error(response.message || 'Zniffer request failed')
    if (action === 'clear') clearBuffer()
    toast.success(action === 'start' ? 'Zniffer capture started' : action === 'stop' ? 'Zniffer capture stopped' : 'Zniffer capture cleared')
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    pendingAction.value = null
  }
}

async function applyFrequency() {
  const value = Number(selectedFrequency.value)
  if (!Number.isFinite(value)) return
  pendingAction.value = 'frequency'
  try {
    const response = await setFrequency(value)
    if (!response.success) throw new Error(response.message || 'Could not set Zniffer frequency')
    state.value = { ...(state.value ?? {}), frequency: value }
    toast.success('Zniffer frequency updated')
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    pendingAction.value = null
  }
}

async function saveServerCapture() {
  pendingAction.value = 'save'
  try {
    const response = await saveCapture()
    if (!response.success) throw new Error(response.message || 'Could not save capture')
    toast.success('Capture saved on server')
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    pendingAction.value = null
  }
}

async function saveZnifferSettings() {
  pendingAction.value = 'settings'
  try {
    const zniffer = { ...settings.value, port: configurePort.value.trim(), enabled: configureEnabled.value }
    const response = await updateSettings({ zniffer })
    settings.value = settingsFrom(response.settings) || zniffer
    toast.success('Zniffer settings saved')
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    pendingAction.value = null
  }
}

function clearBuffer() {
  frames.value = []
  selectedFrame.value = null
  scrollTop.value = 0
  if (framesEl.value) framesEl.value.scrollTop = 0
}

function resetFilters() {
  query.value = ''
  nodeFilter.value = ''
  channelFilter.value = ''
  typeFilter.value = ''
  corruptedOnly.value = false
}

function downloadBuffer() {
  const blob = framesToBlob(isFiltered.value ? filteredFrames.value : frames.value)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  anchor.href = url
  anchor.download = `zwave-zniffer-${isFiltered.value ? 'filtered-' : ''}${timestamp}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function rowTime(frame: ZnifferFrame): string {
  if (!frame.timestamp) return '—'
  const date = frame.timestamp instanceof Date ? frame.timestamp : new Date(frame.timestamp)
  return Number.isNaN(date.getTime()) ? String(frame.timestamp) : date.toLocaleTimeString()
}

function route(frame: ZnifferFrame): string {
  return `${valueOrDash(frame.sourceNodeId)}→${valueOrDash(frame.destinationNodeId)}`
}

function protocol(frame: ZnifferFrame): string {
  return [frame.protocol, frame.protocolDataRate].filter(Boolean).join(' / ') || '—'
}

function shortPayload(frame: ZnifferFrame): string {
  const text = payloadToHex(frame.payload) || frame.raw || ''
  return text.length > 64 ? `${text.slice(0, 64)}…` : text || '—'
}

function settingsFrom(value?: ZwaveUiSettings): ZnifferSettings {
  return isRecord(value?.zniffer) ? (value.zniffer as ZnifferSettings) : {}
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Zniffer request failed'
}

function formatDetailValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function isFrame(value: unknown): value is ZnifferFrame {
  return isRecord(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function valueOrDash(value: unknown): string {
  return value === undefined || value === null || value === '' ? '—' : String(value)
}

watch(
  () => state.value?.frequency,
  (frequency) => {
    if (typeof frequency === 'number') selectedFrequency.value = frequency
  },
)

watch(autoScroll, (enabled) => {
  if (enabled) void scrollToBottom()
})

watch(filteredFrames, () => {
  if (autoScroll.value) void scrollToBottom()
})

onMounted(() => {
  zwaveSocket.subscribe([Channel.znifferFrames, Channel.znifferState])
  zwaveSocket.on(SocketEvent.znifferFrame, handleFrame)
  zwaveSocket.on(SocketEvent.znifferState, handleState)
  zwaveSocket.on('connect', handleConnect)
  zwaveSocket.on('disconnect', handleDisconnect)
  if (typeof ResizeObserver !== 'undefined' && framesEl.value) {
    resizeObserver = new ResizeObserver(updateViewport)
    resizeObserver.observe(framesEl.value)
  }
  updateViewport()
  void loadSettings()
  void loadCapturedFrames()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  zwaveSocket.off(SocketEvent.znifferFrame, handleFrame)
  zwaveSocket.off(SocketEvent.znifferState, handleState)
  zwaveSocket.off('connect', handleConnect)
  zwaveSocket.off('disconnect', handleDisconnect)
  zwaveSocket.unsubscribe([Channel.znifferFrames, Channel.znifferState])
})
</script>

<template>
  <section class="zniffer">
    <BaseCard>
      <template #header>
        <div class="zniffer__header">
          <div>
            <div class="zniffer__eyebrow">
              <BaseBadge variant="expert" size="sm">Expert</BaseBadge>
              <span>Diagnostics</span>
            </div>
            <h1>Zniffer</h1>
            <p>Capture and inspect raw Z-Wave radio traffic with live filters, frame details, and export.</p>
          </div>
          <BaseBadge :variant="statusVariant">
            <StatusDot :status="statusDot" :pulse="running" />
            {{ statusLabel }}
          </BaseBadge>
        </div>
      </template>

      <div class="zniffer__summary">
        <span>Frequency: {{ currentFrequencyLabel }}</span>
        <span>Region: {{ valueOrDash(state?.region ?? settings.region) }}</span>
        <span>{{ filteredFrames.length.toLocaleString() }} shown / {{ frames.length.toLocaleString() }} buffered</span>
      </div>

      <div class="zniffer__controls">
        <BaseButton size="sm" :loading="pendingAction === 'start'" :disabled="running || pendingAction !== null || !configured" @click="runControl('start')">Start</BaseButton>
        <BaseButton size="sm" variant="secondary" :loading="pendingAction === 'stop'" :disabled="!running || pendingAction !== null" @click="runControl('stop')">Stop</BaseButton>
        <BaseButton size="sm" variant="ghost" :loading="pendingAction === 'clear'" :disabled="pendingAction !== null || frames.length === 0" @click="runControl('clear')">Clear capture</BaseButton>
        <BaseButton size="sm" variant="secondary" :loading="pendingAction === 'save'" :disabled="pendingAction !== null || frames.length === 0" @click="saveServerCapture">Save server capture</BaseButton>
        <BaseButton size="sm" variant="secondary" :disabled="frames.length === 0" @click="downloadBuffer">Download {{ isFiltered ? 'view' : 'buffer' }}</BaseButton>
      </div>

      <div class="zniffer__frequency">
        <BaseSelect v-model="selectedFrequency" label="Frequency / region" :options="frequencyOptions" placeholder="No frequencies reported" :disabled="frequencyOptions.length === 0 || pendingAction !== null" />
        <BaseButton size="sm" variant="secondary" :loading="pendingAction === 'frequency'" :disabled="selectedFrequency === '' || pendingAction !== null" @click="applyFrequency">Apply frequency</BaseButton>
      </div>
    </BaseCard>

    <BaseCard v-if="!configured" class="zniffer__setup">
      <template #header>
        <div class="zniffer__header zniffer__header--compact">
          <h2>Zniffer device not configured</h2>
          <BaseBadge variant="advanced" size="sm">Advanced</BaseBadge>
        </div>
      </template>
      <p>Set the Zniffer serial port and enable the Zniffer section in settings before starting capture.</p>
      <AdvancedOnly>
        <div class="zniffer__setup-form">
          <BaseTextField v-model="configurePort" label="Zniffer port" placeholder="/dev/ttyUSB1 or tcp://host:port" />
          <BaseSwitch v-model="configureEnabled" label="Enable Zniffer" />
          <BaseButton size="sm" :loading="pendingAction === 'settings'" :disabled="pendingAction !== null || !configurePort.trim()" @click="saveZnifferSettings">Save Zniffer settings</BaseButton>
        </div>
      </AdvancedOnly>
    </BaseCard>

    <BaseCard flush>
      <template #header>
        <div class="zniffer__filters">
          <BaseTextField v-model="query" type="search" label="Search" placeholder="type, payload, home ID…" />
          <BaseTextField v-model="nodeFilter" type="search" label="Node" placeholder="src or dest" />
          <BaseSelect v-model="channelFilter" label="Channel" :options="channelOptions" />
          <BaseSelect v-model="typeFilter" label="Type" :options="typeOptions" />
          <BaseSwitch v-model="corruptedOnly" label="Corrupted only" />
          <BaseSwitch v-model="autoScroll" label="Auto-scroll" />
          <BaseButton size="sm" variant="ghost" :disabled="!isFiltered" @click="resetFilters">Reset filters</BaseButton>
        </div>
      </template>

      <div ref="framesEl" class="zniffer__viewport" role="table" aria-label="Zniffer frames" @scroll="onScroll">
        <EmptyState v-if="filteredFrames.length === 0" icon="📡" :title="emptyTitle" :description="emptyDescription" />
        <div v-else class="zniffer__spacer" :style="{ paddingTop: `${windowRange.padTop}px`, paddingBottom: `${windowRange.padBottom}px` }">
          <button
            v-for="(frame, index) in visibleFrames"
            :key="`${windowRange.start + index}-${frame.timestamp ?? ''}-${frame.raw ?? frame.payload ?? ''}`"
            class="zniffer__row"
            :class="{ 'zniffer__row--corrupted': frame.corrupted }"
            :style="{ height: `${ROW_HEIGHT}px` }"
            type="button"
            role="row"
            :title="formatFrameSummary(frame)"
            @click="selectedFrame = frame"
          >
            <span>{{ rowTime(frame) }}</span>
            <span>{{ valueOrDash(frame.channel ?? frame.region) }}</span>
            <span>{{ route(frame) }}</span>
            <span>{{ protocol(frame) }}</span>
            <span>{{ valueOrDash(frame.rssi) }}</span>
            <span>{{ valueOrDash(frame.type ?? frame.command) }}</span>
            <span><BaseBadge v-if="frame.corrupted" variant="danger" size="sm">Corrupt</BaseBadge></span>
            <span class="zniffer__payload">{{ shortPayload(frame) }}</span>
          </button>
        </div>
      </div>

      <template #footer>
        <div class="zniffer__footer">
          <span>Buffer capped at {{ MAX_FRAMES.toLocaleString() }} frames; oldest frames are dropped.</span>
          <BaseButton v-if="!autoScroll && filteredFrames.length > 0" size="sm" variant="primary" @click="autoScroll = true">Jump to latest</BaseButton>
        </div>
      </template>
    </BaseCard>

    <BaseModal v-model:open="detailOpen" title="Frame detail" size="lg" @close="selectedFrame = null">
      <div v-if="selectedFrame" class="zniffer__detail">
        <div class="zniffer__detail-summary">{{ formatFrameSummary(selectedFrame) }}</div>
        <dl>
          <template v-for="entry in detailEntries" :key="entry.key">
            <dt>{{ entry.key }}</dt>
            <dd>{{ entry.value }}</dd>
          </template>
        </dl>
        <h3>Payload</h3>
        <pre>{{ payloadToHex(selectedFrame.payload) || selectedFrame.raw || '—' }}</pre>
      </div>
      <template #footer>
        <BaseButton size="sm" variant="secondary" @click="selectedFrame = null">Close</BaseButton>
      </template>
    </BaseModal>
  </section>
</template>

<style scoped>
.zniffer {
  display: grid;
  gap: var(--s-4);
}
.zniffer__header,
.zniffer__controls,
.zniffer__summary,
.zniffer__frequency,
.zniffer__filters,
.zniffer__footer,
.zniffer__setup-form {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  flex-wrap: wrap;
}
.zniffer__header,
.zniffer__footer {
  justify-content: space-between;
}
.zniffer__header h1,
.zniffer__header h2,
.zniffer__header p,
.zniffer__setup p {
  margin: 0;
}
.zniffer__header h1 {
  margin-top: var(--s-2);
  font-size: clamp(1.4rem, 2vw, 2rem);
}
.zniffer__header p,
.zniffer__summary,
.zniffer__footer,
.zniffer__setup p {
  color: var(--color-text-muted);
}
.zniffer__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.zniffer__summary,
.zniffer__controls {
  margin-bottom: var(--s-4);
}
.zniffer__frequency > :first-child,
.zniffer__filters > :first-child {
  flex: 1 1 260px;
}
.zniffer__filters > :nth-child(2),
.zniffer__filters > :nth-child(3) {
  flex: 0 1 150px;
}
.zniffer__setup-form > :first-child {
  flex: 1 1 320px;
}
.zniffer__viewport {
  height: clamp(360px, 58vh, 720px);
  overflow: auto;
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: 0.8125rem;
}
.zniffer__spacer {
  min-width: 1080px;
}
.zniffer__row {
  width: 100%;
  display: grid;
  grid-template-columns: 7rem 7rem 7rem 12rem 5rem 10rem 5rem minmax(18rem, 1fr);
  align-items: center;
  gap: var(--s-3);
  padding: 0 var(--s-3);
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}
.zniffer__row:hover,
.zniffer__row:focus-visible {
  background: var(--color-surface-2);
  outline: none;
}
.zniffer__row--corrupted {
  color: var(--danger);
}
.zniffer__payload {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.zniffer__footer {
  font-size: 0.875rem;
}
.zniffer__detail {
  display: grid;
  gap: var(--s-4);
}
.zniffer__detail-summary {
  color: var(--color-text-muted);
}
.zniffer__detail dl {
  display: grid;
  grid-template-columns: minmax(8rem, 14rem) 1fr;
  gap: var(--s-2) var(--s-4);
  margin: 0;
}
.zniffer__detail dt {
  color: var(--color-text-muted);
  font-weight: 700;
}
.zniffer__detail dd {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.zniffer__detail h3 {
  margin: 0;
}
.zniffer__detail pre {
  margin: 0;
  padding: var(--s-3);
  overflow: auto;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  color: var(--color-text);
  font: inherit;
}
@media (max-width: 760px) {
  .zniffer__controls > *,
  .zniffer__filters > *,
  .zniffer__frequency > *,
  .zniffer__setup-form > * {
    flex: 1 1 100%;
  }
  .zniffer__spacer {
    min-width: 820px;
  }
  .zniffer__row {
    grid-template-columns: 6rem 4rem 6rem 8rem 4rem 7rem 4rem minmax(12rem, 1fr);
  }
}
</style>

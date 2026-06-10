<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { ValueId, ZwaveNode } from '@/api'
import { useNodesStore } from '@/stores/nodes'
import { useUiStore } from '@/stores/ui'
import { capabilityGroups, displayValue, type CapabilityWidget } from '@/devices/capabilities'
import { DEVICE_DETAIL_TABS, isDeviceTabId, visibleTabs, type DeviceTabId } from '@/devices/tabs'
import { batteryInfo, deviceIcon, deviceLocation, deviceName, deviceStatus, primaryControl } from '@/devices/model'
import { pingNode, pollValue, refreshInfo, refreshValues, setNodeLocation, setNodeName, writeValue } from '@/devices/control'
import { useToast } from '@/composables/useToast'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import StatusDot from '@/components/base/StatusDot.vue'

const route = useRoute()
const router = useRouter()
const nodesStore = useNodesStore()
const ui = useUiStore()
const toast = useToast()
const { byId } = storeToRefs(nodesStore)

const nodeId = computed(() => Number(route.params.id))
const node = computed(() => byId.value[nodeId.value])
const loading = computed(() => Object.keys(byId.value).length === 0)
const groups = computed(() => (node.value ? capabilityGroups(node.value) : []))
const allValues = computed(() => Object.values(node.value?.values ?? {}).sort((a, b) => a.id.localeCompare(b.id)))
const tabs = computed(() => visibleTabs(DEVICE_DETAIL_TABS, { advanced: ui.advanced }))
const queryTab = computed(() => String(route.query.tab ?? ''))
const activeTab = ref<DeviceTabId>(isDeviceTabId(queryTab.value) ? queryTab.value : 'overview')
const editingName = ref(false)
const editingLocation = ref(false)
const nameDraft = ref('')
const locationDraft = ref('')
const pending = reactive<Record<string, boolean>>({})
const rawDraft = reactive<Record<string, string | number | boolean>>({})

const statusMeta = computed(() => {
  const status = node.value ? deviceStatus(node.value) : 'unknown'
  const map = {
    ready: { label: 'Ready', badge: 'success', dot: 'ok' },
    asleep: { label: 'Asleep', badge: 'info', dot: 'info' },
    dead: { label: 'Dead', badge: 'danger', dot: 'danger' },
    failed: { label: 'Failed', badge: 'danger', dot: 'danger' },
    unknown: { label: 'Unknown', badge: 'neutral', dot: 'idle' },
  } as const
  return map[status]
})

const overviewWidgets = computed(() => groups.value.flatMap((g) => g.widgets).filter((w) => w.kind !== 'raw').slice(0, 3))
const hasPrimaryControl = computed(() => (node.value ? Boolean(primaryControl(node.value)) : false))

watch(
  () => queryTab.value,
  (tab) => {
    if (isDeviceTabId(tab)) activeTab.value = tab
  },
)

watch(
  tabs,
  (visible) => {
    if (!visible.some((tab) => tab.id === activeTab.value)) setTab('overview')
  },
  { immediate: true },
)

function setTab(id: DeviceTabId) {
  activeTab.value = id
  router.replace({ query: { ...route.query, tab: id === 'overview' ? undefined : id } })
}

function startNameEdit() {
  if (!node.value) return
  nameDraft.value = deviceName(node.value)
  editingName.value = true
}

function startLocationEdit() {
  if (!node.value) return
  locationDraft.value = deviceLocation(node.value) === 'Unassigned' ? '' : deviceLocation(node.value)
  editingLocation.value = true
}

async function saveName() {
  const n = node.value
  const next = nameDraft.value.trim()
  if (!n || !next) return
  const previous = n.name
  nodesStore.upsertNode({ id: n.id, name: next }, true)
  editingName.value = false
  await callWithToast('name', () => setNodeName(n.id, next), 'Name saved', () => nodesStore.upsertNode({ id: n.id, name: previous }, true))
}

async function saveLocation() {
  const n = node.value
  if (!n) return
  const next = locationDraft.value.trim()
  const previous = n.loc
  nodesStore.upsertNode({ id: n.id, loc: next }, true)
  editingLocation.value = false
  await callWithToast('location', () => setNodeLocation(n.id, next), 'Location saved', () => nodesStore.upsertNode({ id: n.id, loc: previous }, true))
}

async function callWithToast(key: string, fn: () => Promise<{ success: boolean; message?: string }>, success: string, rollback?: () => void) {
  if (pending[key]) return
  pending[key] = true
  try {
    const res = await fn()
    if (res.success) toast.success(success)
    else {
      rollback?.()
      toast.error(res.message || 'Z-Wave API call failed')
    }
  } catch {
    rollback?.()
    toast.error('Could not reach the Z-Wave API')
  } finally {
    pending[key] = false
  }
}

function widgetValue(widget: CapabilityWidget): unknown {
  return (widget.read ?? widget.write ?? widget.value)?.value
}

function asNumber(value: unknown, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function isOn(widget: CapabilityWidget): boolean {
  const value = widgetValue(widget)
  if (widget.kind === 'toggle') return value === true || value === widget.onValue
  return value === widget.onValue || (typeof value === 'number' && value > 0)
}

function stateOptions(value?: ValueId) {
  return (value?.states ?? []).map((state) => ({ label: state.text, value: String(state.value) }))
}

function coerceForValue(valueId: ValueId, raw: unknown): unknown {
  const state = valueId.states?.find((s) => String(s.value) === String(raw))
  if (state) return state.value
  if (valueId.type === 'number' || valueId.type === 'duration') return Number(raw)
  if (valueId.type === 'boolean') return Boolean(raw)
  return raw
}

function optimisticValue(valueId: ValueId, value: unknown) {
  nodesStore.updateValue({ ...valueId, value })
}

async function writeControl(widget: CapabilityWidget, value: unknown) {
  if (!widget.write) return
  const write = widget.write
  const previous = write.value
  const next = coerceForValue(write, value)
  optimisticValue(write, next)
  const asleep = node.value && deviceStatus(node.value) === 'asleep'
  if (asleep) toast.info('Device is asleep; write queued until it wakes.')
  await callWithToast(`write:${write.id}`, () => writeValue(write, next), asleep ? 'Write queued' : 'Value written', () => optimisticValue(write, previous))
}

async function writeRaw(valueId: ValueId, value: unknown) {
  const previous = valueId.value
  const next = coerceForValue(valueId, value)
  optimisticValue(valueId, next)
  await callWithToast(`raw:${valueId.id}`, () => writeValue(valueId, next), 'Raw value written', () => optimisticValue(valueId, previous))
}

function rawValue(valueId: ValueId): string | number | boolean {
  if (rawDraft[valueId.id] === undefined) {
    rawDraft[valueId.id] = typeof valueId.value === 'boolean' ? valueId.value : String(valueId.value ?? '')
  }
  return rawDraft[valueId.id]
}

function quickLinkTabs() {
  return tabs.value.filter((tab) => tab.id !== activeTab.value)
}

function securityLabel(n: ZwaveNode): string {
  if (typeof n.security === 'string' && n.security.trim()) return n.security
  if (n.isSecure === true) return 'Secure'
  if (n.isSecure === false) return 'None'
  return 'Unknown'
}

function powerLabel(n: ZwaveNode): string {
  const battery = batteryInfo(n)
  if (battery) return `${battery.level}% battery${battery.low ? ' (low)' : ''}`
  return String(n.powerSource || 'Mains')
}

function lastSeen(value?: number): string {
  if (!value) return 'Never'
  const ms = value > 10_000_000_000 ? value : value * 1000
  const diff = Date.now() - ms
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} hr ago`
  return new Date(ms).toLocaleString()
}

async function refreshDevice() {
  const id = nodeId.value
  await callWithToast(`refresh:${id}`, async () => {
    const values = await refreshValues(id)
    if (!values.success) return values
    return refreshInfo(id)
  }, 'Refresh requested')
}

async function pingDevice() {
  await callWithToast(`ping:${nodeId.value}`, () => pingNode(nodeId.value), 'Ping sent')
}

async function poll(valueId: ValueId) {
  await callWithToast(`poll:${valueId.id}`, () => pollValue(valueId), 'Poll requested')
}
</script>

<template>
  <section v-if="node" class="detail">
    <RouterLink to="/devices" class="detail__back">← All devices</RouterLink>

    <header class="hero card">
      <span class="hero__icon" aria-hidden="true">{{ deviceIcon(node) }}</span>
      <div class="hero__main">
        <div class="hero__title">
          <div v-if="editingName" class="inline-edit">
            <BaseTextField v-model="nameDraft" label="Device name" @keyup.enter="saveName" />
            <BaseButton size="sm" :loading="pending.name" @click="saveName">Save</BaseButton>
            <BaseButton size="sm" variant="ghost" @click="editingName = false">Cancel</BaseButton>
          </div>
          <button v-else class="editable" type="button" @click="startNameEdit">
            <h1>{{ deviceName(node) }}</h1>
            <span aria-hidden="true">✎</span>
          </button>
        </div>

        <div v-if="editingLocation" class="inline-edit inline-edit--compact">
          <BaseTextField v-model="locationDraft" label="Room / location" @keyup.enter="saveLocation" />
          <BaseButton size="sm" :loading="pending.location" @click="saveLocation">Save</BaseButton>
          <BaseButton size="sm" variant="ghost" @click="editingLocation = false">Cancel</BaseButton>
        </div>
        <button v-else class="hero__sub editable editable--muted" type="button" @click="startLocationEdit">
          {{ deviceLocation(node) }} ✎
        </button>

        <p class="hero__meta">{{ node.manufacturer || 'Unknown manufacturer' }} · {{ node.productLabel || node.productDescription || 'Unknown product' }} · Node {{ node.id }}</p>
        <div class="hero__badges">
          <BaseBadge :variant="statusMeta.badge" size="sm"><StatusDot :status="statusMeta.dot" /> {{ statusMeta.label }}</BaseBadge>
          <BaseBadge size="sm" variant="info">🛡 {{ securityLabel(node) }}</BaseBadge>
          <BaseBadge size="sm" :variant="batteryInfo(node)?.low ? 'warning' : 'neutral'">{{ powerLabel(node) }}</BaseBadge>
          <BaseBadge v-if="node.firmwareVersion" size="sm" variant="neutral">FW {{ node.firmwareVersion }}</BaseBadge>
        </div>
      </div>
      <div class="hero__actions">
        <BaseButton size="sm" variant="secondary" :loading="pending[`ping:${node.id}`]" @click="pingDevice">Ping</BaseButton>
        <BaseButton size="sm" variant="secondary" :loading="pending[`refresh:${node.id}`]" @click="refreshDevice">Refresh</BaseButton>
      </div>
    </header>

    <nav class="tabs" aria-label="Device detail tabs">
      <button v-for="tab in tabs" :key="tab.id" class="tab" :class="{ 'tab--active': activeTab === tab.id }" type="button" @click="setTab(tab.id)">
        {{ tab.label }}
        <BaseBadge v-if="tab.tier === 'expert'" size="sm" variant="expert">expert</BaseBadge>
      </button>
    </nav>

    <section v-if="activeTab === 'overview'" class="tabpanel">
      <div class="overview-grid">
        <article class="card facts">
          <h2>Status</h2>
          <dl>
            <div><dt>Health</dt><dd>{{ statusMeta.label }}</dd></div>
            <div><dt>Security</dt><dd>{{ securityLabel(node) }}</dd></div>
            <div><dt>Power</dt><dd>{{ powerLabel(node) }}</dd></div>
            <div><dt>Last seen</dt><dd>{{ lastSeen(node.lastActive) }}</dd></div>
            <div><dt>Firmware</dt><dd>{{ node.firmwareVersion || 'Unknown' }}</dd></div>
            <div><dt>Interview</dt><dd>{{ node.interviewStage || (node.ready ? 'Ready' : 'Pending') }}</dd></div>
          </dl>
        </article>

        <article class="card quick-actions">
          <h2>Primary controls</h2>
          <p v-if="!hasPrimaryControl && overviewWidgets.length === 0" class="muted">No primary controls exposed by this device.</p>
          <div v-for="widget in overviewWidgets" :key="widget.id" class="control-row">
            <span>{{ widget.label }}</span>
            <BaseSwitch v-if="widget.kind === 'toggle'" :model-value="isOn(widget)" :disabled="pending[`write:${widget.write?.id}`]" :label="isOn(widget) ? 'On' : 'Off'" @update:model-value="(v) => writeControl(widget, v)" />
            <div v-else-if="widget.kind === 'slider' || widget.kind === 'cover'" class="slider-line">
              <strong>{{ widgetValue(widget) ?? '—' }}{{ widget.unit || '%' }}</strong>
              <input class="range" type="range" :min="widget.min ?? 0" :max="widget.max ?? 99" :step="widget.step ?? 1" :value="asNumber(widgetValue(widget))" :disabled="pending[`write:${widget.write?.id}`]" @change="(e) => writeControl(widget, (e.target as HTMLInputElement).value)" />
            </div>
            <span v-else class="value-display">{{ displayValue(widget.value ?? widget.read ?? widget.write) }}</span>
          </div>
        </article>
      </div>

      <article class="card quick-links">
        <h2>Quick links</h2>
        <div class="link-grid">
          <button v-for="tab in quickLinkTabs()" :key="tab.id" type="button" class="link-card" @click="setTab(tab.id)">
            {{ tab.label }}
            <BaseBadge v-if="tab.tier === 'expert'" size="sm" variant="expert">expert</BaseBadge>
          </button>
        </div>
      </article>
    </section>

    <section v-else-if="activeTab === 'controls'" class="tabpanel controls">
      <div class="controls__head">
        <div>
          <h2>Controls</h2>
          <p class="muted">Friendly controls generated from command-class values and metadata.</p>
        </div>
        <BaseButton variant="secondary" :loading="pending[`refresh:${node.id}`]" @click="refreshDevice">Refresh values</BaseButton>
      </div>

      <EmptyState v-if="groups.length === 0" icon="🎛️" title="No values" description="This device has not exposed controllable or readable values yet." />

      <article v-for="group in groups" :key="group.id" class="card group-card">
        <header class="group-card__head">
          <div>
            <h3>{{ group.label }}</h3>
            <p class="muted">CC {{ group.commandClass }} · {{ group.values.length }} values</p>
          </div>
          <BaseBadge v-if="group.endpoint > 0" variant="info" size="sm">Endpoint {{ group.endpoint }}</BaseBadge>
        </header>

        <div class="widget-list">
          <div v-for="widget in group.widgets" :key="widget.id" class="widget">
            <div class="widget__label">
              <strong>{{ widget.label }}</strong>
              <small v-if="widget.write && deviceStatus(node) === 'asleep'">Queued until wake-up</small>
            </div>

            <BaseSwitch v-if="widget.kind === 'toggle'" :model-value="isOn(widget)" :disabled="pending[`write:${widget.write?.id}`]" :label="isOn(widget) ? 'On' : 'Off'" @update:model-value="(v) => writeControl(widget, v)" />

            <div v-else-if="widget.kind === 'slider' || widget.kind === 'cover'" class="slider-control">
              <div class="slider-control__top">
                <BaseButton size="sm" variant="secondary" :disabled="pending[`write:${widget.write?.id}`]" @click="writeControl(widget, widget.offValue)">{{ widget.kind === 'cover' ? 'Close' : 'Off' }}</BaseButton>
                <strong>{{ widgetValue(widget) ?? '—' }}{{ widget.unit || '%' }}</strong>
                <BaseButton size="sm" variant="primary" :disabled="pending[`write:${widget.write?.id}`]" @click="writeControl(widget, widget.onValue)">{{ widget.kind === 'cover' ? 'Open' : 'On' }}</BaseButton>
              </div>
              <input class="range" type="range" :min="widget.min ?? 0" :max="widget.max ?? 99" :step="widget.step ?? 1" :value="asNumber(widgetValue(widget))" :disabled="pending[`write:${widget.write?.id}`]" @change="(e) => writeControl(widget, (e.target as HTMLInputElement).value)" />
            </div>

            <input v-else-if="widget.kind === 'color'" class="color-input" type="color" :value="String(widgetValue(widget) || '#ffffff')" :disabled="pending[`write:${widget.write?.id}`]" @change="(e) => writeControl(widget, (e.target as HTMLInputElement).value)" />

            <BaseSelect v-else-if="widget.kind === 'thermostat' && widget.write?.states?.length" :model-value="String(widgetValue(widget) ?? widget.write.value ?? '')" :options="stateOptions(widget.write)" :disabled="pending[`write:${widget.write.id}`]" @update:model-value="(v) => writeControl(widget, v)" />

            <div v-else-if="widget.kind === 'thermostat' && widget.write" class="number-control">
              <input class="input" type="number" :min="widget.min" :max="widget.max" :step="widget.step ?? 1" :value="asNumber(widgetValue(widget), asNumber(widget.write.value))" :disabled="pending[`write:${widget.write.id}`]" @change="(e) => writeControl(widget, (e.target as HTMLInputElement).value)" />
              <span>{{ widget.unit }}</span>
            </div>

            <div v-else-if="widget.kind === 'lock'" class="button-pair">
              <BaseButton size="sm" variant="secondary" :disabled="pending[`write:${widget.write?.id}`]" @click="writeControl(widget, widget.offValue)">Unlock</BaseButton>
              <BaseButton size="sm" variant="danger" :disabled="pending[`write:${widget.write?.id}`]" @click="writeControl(widget, widget.onValue)">Lock</BaseButton>
            </div>

            <div v-else class="readout">
              <span>{{ displayValue(widget.value ?? widget.read ?? widget.write) }}</span>
              <BaseButton v-if="(widget.value ?? widget.read)?.readable" size="sm" variant="ghost" :loading="pending[`poll:${(widget.value ?? widget.read)?.id}`]" @click="poll((widget.value ?? widget.read)!)">Poll</BaseButton>
            </div>
          </div>
        </div>
      </article>

      <AdvancedOnly>
        <article class="card all-values">
          <h3>All values</h3>
          <div class="raw-table">
            <div v-for="value in allValues" :key="value.id" class="raw-row">
              <div>
                <strong>{{ value.label || value.propertyName || value.property }}</strong>
                <small>CC {{ value.commandClass }} · endpoint {{ value.endpoint ?? 0 }} · {{ value.id }}</small>
              </div>
              <span>{{ displayValue(value) }}</span>
              <BaseSelect v-if="value.writeable && value.states?.length" :model-value="String(rawValue(value))" :options="stateOptions(value)" @update:model-value="(v) => writeRaw(value, v)" />
              <BaseSwitch v-else-if="value.writeable && value.type === 'boolean'" :model-value="Boolean(rawValue(value))" @update:model-value="(v) => writeRaw(value, v)" />
              <input v-else-if="value.writeable" class="input" :type="value.type === 'number' || value.type === 'duration' ? 'number' : 'text'" :value="rawValue(value)" @change="(e) => writeRaw(value, (e.target as HTMLInputElement).value)" />
              <span v-else class="muted">Read-only</span>
            </div>
          </div>
        </article>
      </AdvancedOnly>
    </section>

    <section v-else class="tabpanel">
      <article class="card coming-soon">
        <BaseBadge :variant="DEVICE_DETAIL_TABS.find((tab) => tab.id === activeTab)?.tier === 'expert' ? 'expert' : 'advanced'">
          {{ DEVICE_DETAIL_TABS.find((tab) => tab.id === activeTab)?.tier }}
        </BaseBadge>
        <h2>{{ DEVICE_DETAIL_TABS.find((tab) => tab.id === activeTab)?.label }} coming soon</h2>
        <p class="muted">This tab is visible only in advanced mode and will be implemented in a later issue.</p>
      </article>
    </section>
  </section>

  <EmptyState v-else-if="loading" icon="⏳" title="Loading device" description="Waiting for the network snapshot from the Z-Wave backend." />

  <EmptyState v-else icon="❓" title="Device not found" :description="`No device with id ${nodeId} is on the network.`">
    <template #action><RouterLink to="/devices" class="detail__back">Back to devices</RouterLink></template>
  </EmptyState>
</template>

<style scoped>
.detail { display: grid; gap: var(--s-5); }
.detail__back { color: var(--color-text-muted); text-decoration: none; font-size: 0.875rem; width: fit-content; }
.detail__back:hover { color: var(--color-text); }
.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); box-shadow: var(--shadow-1); padding: var(--s-5); }
.hero { display: flex; gap: var(--s-4); align-items: flex-start; }
.hero__icon { width: 60px; height: 60px; display: grid; place-items: center; background: var(--accent-on); border-radius: var(--r-md); font-size: 2rem; flex: none; }
.hero__main { flex: 1; min-width: 0; }
.hero__title { display: flex; align-items: center; gap: var(--s-2); }
.hero__sub { margin-top: var(--s-1); }
.hero__meta, .muted { color: var(--color-text-muted); }
.hero__meta { margin: var(--s-2) 0 0; }
.hero__badges, .hero__actions, .inline-edit, .slider-control__top, .button-pair { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; }
.hero__badges { margin-top: var(--s-3); }
.hero__actions { justify-content: flex-end; }
.editable { border: 0; background: transparent; color: var(--color-text); padding: 0; display: inline-flex; align-items: center; gap: var(--s-2); cursor: pointer; text-align: left; }
.editable h1 { margin: 0; font-size: 1.75rem; }
.editable--muted { color: var(--color-text-muted); }
.inline-edit { align-items: end; }
.inline-edit--compact { margin-top: var(--s-2); }
.tabs { display: flex; gap: var(--s-2); overflow-x: auto; border-bottom: 1px solid var(--color-border); padding-bottom: var(--s-2); }
.tab { border: 1px solid transparent; background: transparent; color: var(--color-text-muted); padding: var(--s-3) var(--s-4); border-radius: var(--r-pill); display: inline-flex; align-items: center; gap: var(--s-2); white-space: nowrap; cursor: pointer; }
.tab:hover, .tab--active { color: var(--color-text); background: var(--color-surface-2); border-color: var(--color-border); }
.tabpanel { display: grid; gap: var(--s-4); }
.overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--s-4); }
h2, h3 { margin: 0; }
.facts dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--s-4); margin: var(--s-4) 0 0; }
.facts dt { color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
.facts dd { margin: var(--s-1) 0 0; font-weight: 600; }
.quick-actions, .quick-links, .group-card, .all-values { display: grid; gap: var(--s-4); }
.control-row, .widget, .raw-row { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(160px, 2fr); gap: var(--s-3); align-items: center; padding: var(--s-3) 0; border-top: 1px solid var(--color-border); }
.control-row:first-of-type, .widget:first-child, .raw-row:first-child { border-top: 0; }
.slider-line, .slider-control { display: grid; gap: var(--s-2); }
.range { width: 100%; accent-color: var(--color-primary); }
.value-display, .readout { font-weight: 600; }
.link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--s-3); }
.link-card { border: 1px solid var(--color-border); border-radius: var(--r-md); background: var(--color-surface-2); color: var(--color-text); padding: var(--s-4); display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.controls__head, .group-card__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--s-3); }
.group-card__head h3 { margin-bottom: var(--s-1); }
.widget__label { display: grid; gap: var(--s-1); }
.widget__label small, .raw-row small { color: var(--color-text-muted); font-size: 0.75rem; }
.readout { display: flex; justify-content: space-between; align-items: center; gap: var(--s-2); }
.number-control { display: flex; align-items: center; gap: var(--s-2); }
.input, .color-input { width: 100%; padding: var(--s-3); font: inherit; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-md); }
.color-input { min-height: 44px; padding: var(--s-1); }
.raw-table { display: grid; }
.raw-row { grid-template-columns: minmax(180px, 2fr) minmax(100px, 1fr) minmax(160px, 1fr); }
.coming-soon { text-align: center; display: grid; justify-items: center; gap: var(--s-3); }
@media (max-width: 720px) {
  .hero, .controls__head, .group-card__head { flex-direction: column; }
  .hero__actions { justify-content: flex-start; }
  .control-row, .widget, .raw-row { grid-template-columns: 1fr; }
  .editable h1 { font-size: 1.35rem; }
}
</style>

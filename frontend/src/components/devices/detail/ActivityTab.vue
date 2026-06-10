<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Channel, SocketEvent, zwaveSocket, type CallApiResult, type ZwaveNode } from '@/api'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import {
  defaultMaintenanceApi,
  eventMatchesNode,
  formatNodeEvent,
  maintenanceActions,
  performMaintenanceAction,
  pushEvent,
  type ActivityFeedItem,
  type MaintenanceAction,
  type MaintenanceActionId,
} from '@/devices/maintenance'
import { batteryInfo, deviceStatus } from '@/devices/model'

const props = defineProps<{ node: ZwaveNode }>()

const toast = useToast()
const { confirm } = useConfirm()
const events = ref<ActivityFeedItem[]>(initialEvents())
const pending = ref<Partial<Record<MaintenanceActionId, boolean>>>({})
const neighborIds = ref<readonly number[] | null>(Array.isArray(props.node.neighbors) ? props.node.neighbors : null)

const actions = computed(() => maintenanceActions(props.node))
const status = computed(() => deviceStatus(props.node))
const isBatteryDevice = computed(() => batteryInfo(props.node) !== null || props.node.powerSource === 'Battery')
const keepAwakeLabel = computed(() => (props.node.keepAwake ? 'Enabled' : 'Disabled'))

function initialEvents(): ActivityFeedItem[] {
  const queue = props.node.eventsQueue
  if (!Array.isArray(queue)) return []
  return queue
    .map((event) => formatNodeEvent({ nodeId: props.node.id, event }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 50)
}

function record(payload: unknown) {
  events.value = pushEvent(events.value, formatNodeEvent(payload))
}

function handleNodeEvent(payload: unknown) {
  if (eventMatchesNode(payload, props.node.id)) record(payload)
}

function handleValueEvent(payload: unknown) {
  if (eventMatchesNode(payload, props.node.id)) record(payload)
}

function handleNodeUpdated(payload: unknown) {
  if (eventMatchesNode(payload, props.node.id)) record(payload)
}

function handleRoutesProgress(payload: unknown) {
  if (!Array.isArray(payload)) return
  const match = payload.find((entry) => Array.isArray(entry) && entry[0] === props.node.id)
  if (match) record([match])
}

onMounted(() => {
  zwaveSocket.subscribe([Channel.nodes, Channel.values, Channel.rebuild])
  zwaveSocket.on(SocketEvent.nodeEvent, handleNodeEvent)
  zwaveSocket.on(SocketEvent.valueUpdated, handleValueEvent)
  zwaveSocket.on(SocketEvent.valueRemoved, handleValueEvent)
  zwaveSocket.on(SocketEvent.metadataUpdated, handleValueEvent)
  zwaveSocket.on(SocketEvent.nodeUpdated, handleNodeUpdated)
  zwaveSocket.on(SocketEvent.rebuildRoutesProgress, handleRoutesProgress)
})

onBeforeUnmount(() => {
  zwaveSocket.off(SocketEvent.nodeEvent, handleNodeEvent)
  zwaveSocket.off(SocketEvent.valueUpdated, handleValueEvent)
  zwaveSocket.off(SocketEvent.valueRemoved, handleValueEvent)
  zwaveSocket.off(SocketEvent.metadataUpdated, handleValueEvent)
  zwaveSocket.off(SocketEvent.nodeUpdated, handleNodeUpdated)
  zwaveSocket.off(SocketEvent.rebuildRoutesProgress, handleRoutesProgress)
})

async function runAction(action: MaintenanceAction) {
  if (!action.enabled || pending.value[action.id]) return
  if (action.id === 'refresh-info') {
    const ok = await confirm({
      title: 'Re-interview node?',
      message: 'Re-interviewing can take several minutes and may wake or query the device repeatedly.',
      confirmText: 'Re-interview',
    })
    if (!ok) return
  }

  pending.value = { ...pending.value, [action.id]: true }
  try {
    const result = await performMaintenanceAction(defaultMaintenanceApi, props.node.id, action.id, confirmRemove)
    handleResult(action, result)
  } catch {
    toast.error('Could not reach the Z-Wave API')
  } finally {
    pending.value = { ...pending.value, [action.id]: false }
  }
}

async function confirmRemove(opts: Parameters<typeof confirm>[0]) {
  return confirm(opts)
}

function handleResult(action: MaintenanceAction, result: CallApiResult) {
  if (!result.success) {
    toast.error(result.message || `${action.label} failed`)
    return
  }

  if (action.id === 'remove-failed' && result.result === false) return
  if (action.id === 'get-neighbors' && Array.isArray(result.result)) {
    neighborIds.value = result.result
  }
  toast.success(successMessage(action, result))
}

function successMessage(action: MaintenanceAction, result: CallApiResult): string {
  if (action.id === 'ping') return result.result === false ? 'Ping completed: no response' : 'Ping completed'
  if (action.id === 'get-neighbors') return 'Neighbors loaded'
  if (action.id === 'remove-failed') return 'Remove failed node requested'
  return `${action.label} requested`
}

function timeLabel(time: number): string {
  return new Date(time).toLocaleString()
}
</script>

<template>
  <section class="activity-tab">
    <article class="card maintenance">
      <header class="section-head">
        <div>
          <h2>Maintenance</h2>
          <p class="muted">Advanced node operations for Node {{ node.id }}.</p>
        </div>
        <BaseBadge :variant="status === 'dead' || status === 'failed' ? 'danger' : 'neutral'" size="sm">
          <StatusDot :status="status === 'dead' || status === 'failed' ? 'danger' : status === 'asleep' ? 'info' : 'ok'" />
          {{ status }}
        </BaseBadge>
      </header>

      <div class="action-grid">
        <div v-for="action in actions" :key="action.id" class="action-card" :class="{ 'action-card--disabled': !action.enabled }">
          <div class="action-card__body">
            <div class="action-card__title">
              <h3>{{ action.label }}</h3>
              <BaseBadge :variant="action.tier" size="sm">{{ action.tier }}</BaseBadge>
            </div>
            <p>{{ action.description }}</p>
          </div>
          <BaseButton
            :variant="action.danger ? 'danger' : 'secondary'"
            size="sm"
            :loading="pending[action.id]"
            :disabled="!action.enabled"
            @click="runAction(action)"
          >
            Run
          </BaseButton>
        </div>
      </div>

      <div class="node-facts">
        <div>
          <span>Neighbors</span>
          <strong>{{ neighborIds?.length ? neighborIds.join(', ') : 'Unknown' }}</strong>
        </div>
        <div v-if="isBatteryDevice || node.keepAwake !== undefined">
          <span>Keep awake</span>
          <strong>{{ keepAwakeLabel }}</strong>
        </div>
      </div>
    </article>

    <article class="card feed">
      <header class="section-head">
        <div>
          <h2>Live activity</h2>
          <p class="muted">Recent node events, value updates, and maintenance progress while this tab is open.</p>
        </div>
        <BaseBadge size="sm" variant="neutral">last {{ events.length }}/50</BaseBadge>
      </header>

      <EmptyState
        v-if="events.length === 0"
        icon="📡"
        title="No activity yet"
        description="Events for this node will appear here as they arrive."
      />
      <ol v-else class="event-list">
        <li v-for="(event, index) in events" :key="`${event.time}-${index}`" class="event-item">
          <time :datetime="new Date(event.time).toISOString()">{{ timeLabel(event.time) }}</time>
          <div>
            <strong>{{ event.label }}</strong>
            <p v-if="event.detail">{{ event.detail }}</p>
          </div>
        </li>
      </ol>
    </article>
  </section>
</template>

<style scoped>
.activity-tab {
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
.section-head {
  display: flex;
  justify-content: space-between;
  gap: var(--s-3);
  align-items: flex-start;
}
h2,
h3,
p {
  margin: 0;
}
.muted {
  color: var(--color-text-muted);
}
.maintenance,
.feed {
  display: grid;
  gap: var(--s-4);
}
.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--s-3);
}
.action-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--s-3);
  align-items: center;
  padding: var(--s-4);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  background: var(--color-surface-2);
}
.action-card--disabled {
  opacity: 0.7;
}
.action-card__body {
  display: grid;
  gap: var(--s-2);
}
.action-card__title {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
}
.action-card p,
.event-item p {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
.node-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--s-3);
}
.node-facts div {
  display: grid;
  gap: var(--s-1);
  padding: var(--s-3);
  border-radius: var(--r-md);
  background: var(--color-surface-2);
}
.node-facts span,
.event-item time {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
}
.event-item {
  display: grid;
  grid-template-columns: minmax(150px, 0.4fr) 1fr;
  gap: var(--s-3);
  padding: var(--s-3) 0;
  border-top: 1px solid var(--color-border);
}
.event-item:first-child {
  border-top: 0;
}
@media (max-width: 720px) {
  .section-head,
  .action-card {
    grid-template-columns: 1fr;
  }
  .section-head {
    flex-direction: column;
  }
  .event-item {
    grid-template-columns: 1fr;
  }
}
</style>

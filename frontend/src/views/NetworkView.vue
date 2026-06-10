<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Channel, SocketEvent, zwaveSocket, type ZwaveNode } from '@/api'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import HealthSummary from '@/components/network/HealthSummary.vue'
import MeshMap from '@/components/network/MeshMap.vue'
import NodeStatList from '@/components/network/NodeStatList.vue'
import StatisticsPanel from '@/components/network/StatisticsPanel.vue'
import { deviceName, deviceStatus } from '@/devices/model'
import { useControllerStore } from '@/stores/controller'
import { useNodesStore } from '@/stores/nodes'
import {
  abortHealthCheck,
  buildMeshGraph,
  checkLifelineHealth,
  checkLinkReliability,
  checkRouteHealth,
  discoverNodeNeighbors,
  getNodeNeighbors,
  healthProgressReducer,
  networkCounts,
  parseHealthProgress,
  refreshNeighbors,
  type HealthProgressState,
} from '@/network/health'

const nodesStore = useNodesStore()
const controllerStore = useControllerStore()
const { list } = storeToRefs(nodesStore)

const graphLibraryAvailable = false
const neighborMap = ref<Record<number, number[]>>({})
const loadingNeighbors = ref(false)
const refreshingAll = ref(false)
const busyNode = ref<number | null>(null)
const error = ref<string | null>(null)
const statistics = ref<unknown>(null)
const statisticsUpdatedAt = ref<number | null>(null)
const linkProgress = ref<unknown>(null)
const healthProgress = ref<HealthProgressState>(null)
const healthResult = ref<unknown>(null)
const runningHealthNode = ref<number | null>(null)

const selectedNodeId = ref<string | number>('')
const targetNodeId = ref<string | number>('')
const rounds = ref<string | number>(5)

const nodes = computed(() => list.value)
const selectableNodes = computed(() => nodes.value.filter((node) => !node.isControllerNode))
const counts = computed(() => networkCounts(nodes.value))
const graph = computed(() => buildMeshGraph(nodes.value, neighborMap.value))
const problemNodes = computed(() => nodes.value.filter((node) => ['dead', 'failed'].includes(deviceStatus(node))))
const controllerStatus = computed(
  () => controllerStore.controllerStatus ?? controllerStore.info?.cntStatus ?? controllerStore.info?.status ?? controllerStore.status,
)
const rfRegion = computed(() => readInfoString(['rfRegion', 'region', 'zwaveRegion']) ?? 'Unknown')
const rssiSummary = computed(() => summarizeRssi(statistics.value))
const selectedNodeNumber = computed(() => Number(selectedNodeId.value) || undefined)
const targetNodeNumber = computed(() => Number(targetNodeId.value) || undefined)
const roundsNumber = computed(() => Math.max(1, Number(rounds.value) || 5))
const nodeOptions = computed(() => [
  { label: 'Select node', value: '' },
  ...selectableNodes.value.map((node) => ({ label: `${node.id}: ${deviceName(node)}`, value: node.id })),
])
const targetOptions = computed(() => [
  { label: 'Controller / lifeline', value: '' },
  ...nodes.value.map((node) => ({ label: `${node.id}: ${deviceName(node)}`, value: node.id })),
])
const roundOptions = [1, 3, 5, 10].map((value) => ({ label: `${value} rounds`, value }))
const canRunNodeAction = computed(() => selectedNodeNumber.value !== undefined && runningHealthNode.value === null)

async function loadNeighbors() {
  loadingNeighbors.value = true
  error.value = null
  try {
    const pairs = await Promise.all(
      nodes.value.map(async (node) => {
        const response = await getNodeNeighbors(node.id)
        return [node.id, response.success && Array.isArray(response.result) ? [...response.result] : node.neighbors ?? []] as const
      }),
    )
    neighborMap.value = Object.fromEntries(pairs)
  } catch (err) {
    error.value = messageFrom(err)
  } finally {
    loadingNeighbors.value = false
  }
}

async function refreshAllNeighbors() {
  refreshingAll.value = true
  error.value = null
  try {
    const response = await refreshNeighbors()
    if (!response.success) throw new Error(response.message || 'Unable to refresh neighbors')
    if (response.result) neighborMap.value = normalizeNeighborRecord(response.result)
    else await loadNeighbors()
  } catch (err) {
    error.value = messageFrom(err)
  } finally {
    refreshingAll.value = false
  }
}

async function discoverNeighbors(nodeId: number) {
  busyNode.value = nodeId
  error.value = null
  try {
    const response = await discoverNodeNeighbors(nodeId)
    if (!response.success) throw new Error(response.message || `Unable to discover neighbors for node ${nodeId}`)
    const neighbors = await getNodeNeighbors(nodeId)
    if (neighbors.success && Array.isArray(neighbors.result)) {
      neighborMap.value = { ...neighborMap.value, [nodeId]: [...neighbors.result] }
    }
  } catch (err) {
    error.value = messageFrom(err)
  } finally {
    busyNode.value = null
  }
}

async function runLifelineHealth() {
  if (!selectedNodeNumber.value) return
  await runHealth(selectedNodeNumber.value, undefined, () => checkLifelineHealth(selectedNodeNumber.value!, roundsNumber.value))
}

async function runRouteHealth() {
  if (!selectedNodeNumber.value || !targetNodeNumber.value) return
  await runHealth(selectedNodeNumber.value, targetNodeNumber.value, () =>
    checkRouteHealth(selectedNodeNumber.value!, targetNodeNumber.value!, roundsNumber.value),
  )
}

async function runLinkReliability() {
  if (!selectedNodeNumber.value) return
  await runHealth(selectedNodeNumber.value, undefined, () =>
    checkLinkReliability(selectedNodeNumber.value!, { rounds: roundsNumber.value }),
  )
}

async function runHealth(nodeId: number, targetId: number | undefined, action: () => Promise<{ success: boolean; message: string; result?: unknown }>) {
  runningHealthNode.value = nodeId
  healthResult.value = null
  error.value = null
  healthProgress.value = healthProgressReducer(null, { type: 'start', nodeId, targetNodeId: targetId, totalRounds: roundsNumber.value })
  try {
    const response = await action()
    if (!response.success) throw new Error(response.message || 'Health check failed')
    healthResult.value = response.result ?? response.message
    healthProgress.value = healthProgress.value
      ? { ...healthProgress.value, phase: 'complete', canAbort: false, roundsDone: healthProgress.value.totalRounds }
      : null
  } catch (err) {
    error.value = messageFrom(err)
    healthProgress.value = healthProgressReducer(healthProgress.value, { type: 'error', message: error.value })
  } finally {
    runningHealthNode.value = null
  }
}

async function abortCurrentHealthCheck() {
  if (!runningHealthNode.value) return
  try {
    await abortHealthCheck(runningHealthNode.value)
    healthProgress.value = healthProgressReducer(healthProgress.value, { type: 'abort' })
  } catch (err) {
    error.value = messageFrom(err)
  } finally {
    runningHealthNode.value = null
  }
}

function handleHealthProgress(payload: unknown) {
  const event = parseHealthProgress(payload)
  if (event) healthProgress.value = healthProgressReducer(healthProgress.value, event)
}

function handleLinkReliability(payload: unknown) {
  linkProgress.value = payload
}

function handleStatistics(payload: unknown) {
  statistics.value = payload
  statisticsUpdatedAt.value = Date.now()
}

function handleNodeUpdated(payload: unknown) {
  const node = nodeFromPayload(payload)
  if (node?.neighbors) neighborMap.value = { ...neighborMap.value, [node.id]: [...node.neighbors] }
}

function normalizeNeighborRecord(record: Record<number, number[]>): Record<number, number[]> {
  return Object.fromEntries(Object.entries(record).map(([nodeId, neighbors]) => [Number(nodeId), [...neighbors]]))
}

function nodeFromPayload(payload: unknown): Pick<ZwaveNode, 'id' | 'neighbors'> | null {
  if (!isRecord(payload)) return null
  const candidate = isRecord(payload.node) ? payload.node : payload
  if (typeof candidate.id !== 'number') return null
  return Array.isArray(candidate.neighbors) ? { id: candidate.id, neighbors: candidate.neighbors.filter(isNumber) } : null
}

function readInfoString(keys: string[]): string | null {
  const info = controllerStore.info
  if (!info) return null
  for (const key of keys) {
    const value = info[key]
    if (typeof value === 'string' || typeof value === 'number') return String(value)
  }
  return null
}

function summarizeRssi(value: unknown): string | undefined {
  const text = findFirstNumber(value, ['backgroundRSSI', 'backgroundRssi', 'rssi', 'noiseFloor'])
  return text === undefined ? undefined : `${text} dBm`
}

function findFirstNumber(value: unknown, keys: string[]): number | undefined {
  if (!isRecord(value)) return undefined
  for (const key of keys) {
    const entry = value[key]
    if (typeof entry === 'number') return entry
    if (Array.isArray(entry)) {
      const nums = entry.filter(isNumber)
      if (nums.length) return Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length)
    }
  }
  for (const entry of Object.values(value)) {
    const nested = findFirstNumber(entry, keys)
    if (nested !== undefined) return nested
  }
  return undefined
}

function messageFrom(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

onMounted(() => {
  zwaveSocket.subscribe([Channel.statistics, Channel.diagnostics, Channel.nodes])
  zwaveSocket.on(SocketEvent.statistics, handleStatistics)
  zwaveSocket.on(SocketEvent.healthCheckProgress, handleHealthProgress)
  zwaveSocket.on(SocketEvent.linkReliability, handleLinkReliability)
  zwaveSocket.on(SocketEvent.nodeUpdated, handleNodeUpdated)
  void loadNeighbors()
})

onUnmounted(() => {
  zwaveSocket.off(SocketEvent.statistics, handleStatistics)
  zwaveSocket.off(SocketEvent.healthCheckProgress, handleHealthProgress)
  zwaveSocket.off(SocketEvent.linkReliability, handleLinkReliability)
  zwaveSocket.off(SocketEvent.nodeUpdated, handleNodeUpdated)
  zwaveSocket.unsubscribe([Channel.statistics, Channel.diagnostics, Channel.nodes])
})
</script>

<template>
  <section class="network-view">
    <header class="network-view__hero">
      <div>
        <p class="eyebrow">Network</p>
        <h1>Health overview & mesh map</h1>
        <p>Watch node health, neighbor topology, diagnostics progress, and live statistics.</p>
      </div>
      <RouterLink :to="{ name: 'controller-maintenance' }">
        <BaseButton variant="secondary">Controller maintenance</BaseButton>
      </RouterLink>
    </header>

    <p v-if="error" class="network-view__error" role="alert">{{ error }}</p>

    <HealthSummary
      :counts="counts"
      :problem-nodes="problemNodes"
      :controller-status="controllerStatus"
      :rf-region="rfRegion"
      :rssi-summary="rssiSummary"
    />

    <AdvancedOnly>
      <section class="network-section">
        <div class="network-section__header">
          <div>
            <h2>Mesh map</h2>
            <p>Neighbor links are deduped into a topology list for mobile and graph fallback.</p>
          </div>
          <div class="network-section__actions">
            <BaseBadge variant="advanced">Advanced</BaseBadge>
            <BaseButton variant="secondary" :loading="loadingNeighbors" @click="loadNeighbors">Load neighbors</BaseButton>
            <BaseButton :loading="refreshingAll" @click="refreshAllNeighbors">Refresh all</BaseButton>
          </div>
        </div>
        <BaseCard>
          <MeshMap :graph="graph" :graph-library-available="graphLibraryAvailable" />
        </BaseCard>
      </section>
    </AdvancedOnly>

    <section class="network-section">
      <div class="network-section__header">
        <div>
          <h2>Neighbors</h2>
          <p>Read current controller neighbor data or ask a node to rediscover its neighbors.</p>
        </div>
      </div>
      <BaseCard>
        <NodeStatList :nodes="nodes" :neighbors="neighborMap" :busy-node="busyNode" @discover="discoverNeighbors" />
      </BaseCard>
    </section>

    <AdvancedOnly>
      <section class="network-section">
        <div class="network-section__header">
          <div>
            <h2>Health checks</h2>
            <p>Lifeline, route health, and link reliability report live progress from diagnostics events.</p>
          </div>
          <BaseBadge variant="advanced">Advanced</BaseBadge>
        </div>
        <BaseCard>
          <div class="health-tools">
            <BaseSelect v-model="selectedNodeId" label="Node" :options="nodeOptions" />
            <BaseSelect v-model="targetNodeId" label="Target" :options="targetOptions" />
            <BaseSelect v-model="rounds" label="Rounds" :options="roundOptions" />
            <div class="health-tools__buttons">
              <BaseButton :disabled="!canRunNodeAction" @click="runLifelineHealth">Lifeline</BaseButton>
              <BaseButton :disabled="!canRunNodeAction || !targetNodeNumber" @click="runRouteHealth">Route</BaseButton>
              <BaseButton :disabled="!canRunNodeAction" @click="runLinkReliability">Link reliability</BaseButton>
              <BaseButton variant="danger" :disabled="!healthProgress?.canAbort" @click="abortCurrentHealthCheck">Abort</BaseButton>
            </div>
          </div>
          <div class="progress-card">
            <div class="progress-card__bar"><span :style="{ width: `${healthProgress ? Math.min(100, (healthProgress.roundsDone / Math.max(1, healthProgress.totalRounds)) * 100) : 0}%` }" /></div>
            <p>
              {{ healthProgress ? `${healthProgress.phase}: ${healthProgress.roundsDone}/${healthProgress.totalRounds} rounds` : 'No health check running.' }}
              <span v-if="healthProgress?.rating !== undefined"> · rating {{ healthProgress.rating }}</span>
            </p>
            <pre v-if="healthResult">{{ JSON.stringify(healthResult, null, 2) }}</pre>
          </div>
        </BaseCard>
      </section>
    </AdvancedOnly>

    <section class="network-section">
      <div class="network-section__header">
        <div>
          <h2>Statistics</h2>
          <p>Live controller and node statistics from the statistics channel.</p>
        </div>
      </div>
      <StatisticsPanel :statistics="statistics" :link-progress="linkProgress" :updated-at="statisticsUpdatedAt" />
    </section>
  </section>
</template>

<style scoped>
.network-view,
.network-section {
  display: grid;
  gap: var(--s-5);
}
.network-view__hero,
.network-section__header,
.network-section__actions,
.health-tools__buttons {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  flex-wrap: wrap;
}
.network-view__hero h1,
.network-section h2 {
  margin: 0;
}
.network-view__hero p,
.network-section__header p {
  margin: var(--s-2) 0 0;
  color: var(--color-text-muted);
}
.eyebrow {
  margin: 0 0 var(--s-1) !important;
  color: var(--color-primary-strong) !important;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.75rem;
}
.network-view__error {
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--danger);
  border-radius: var(--r-md);
  background: var(--danger-soft);
  color: var(--danger);
}
.health-tools {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--s-3);
  align-items: end;
}
.health-tools__buttons {
  justify-content: flex-start;
  grid-column: 1 / -1;
}
.progress-card {
  display: grid;
  gap: var(--s-2);
  margin-top: var(--s-4);
}
.progress-card__bar {
  height: 10px;
  overflow: hidden;
  border-radius: var(--r-pill);
  background: var(--color-surface-2);
}
.progress-card__bar span {
  display: block;
  height: 100%;
  background: var(--color-primary);
}
.progress-card p {
  margin: 0;
  color: var(--color-text-muted);
}
.progress-card pre {
  margin: 0;
  padding: var(--s-3);
  border-radius: var(--r-md);
  background: var(--color-surface-2);
  color: var(--color-text);
  white-space: pre-wrap;
}
@media (max-width: 640px) {
  .network-view__hero,
  .network-section__header {
    align-items: stretch;
  }
}
</style>

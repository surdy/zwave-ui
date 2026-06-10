<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Channel, SocketEvent, type ZwaveNode, zwaveSocket } from '@/api'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import S2GrantClasses from '@/components/add-device/S2GrantClasses.vue'
import S2ValidateDsk from '@/components/add-device/S2ValidateDsk.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { setNodeLocation, setNodeName } from '@/devices/control'
import {
  abortInclusion,
  grantSecurityClasses,
  inclusionReducer,
  initialInclusionState,
  isInclusionDone,
  replaceFailedNode,
  startExclusion,
  startInclusion,
  stopExclusion,
  stopInclusion,
  strategyForChoice,
  validateDSK,
  type InclusionChoice,
  type InclusionMode,
  type InclusionState,
  type SecurityClassGrant,
} from '@/devices/inclusion'

const toast = useToast()
const { confirm } = useConfirm()

const state = ref<InclusionState>(initialInclusionState())
const securityChoice = ref<InclusionChoice>('s2-default')
const busy = ref(false)
const name = ref('')
const location = ref('')
const replaceNodeId = ref('')

const securityOptions = [
  { label: 'Recommended: S2 when available', value: 's2-default' },
  { label: 'Require S2 secure inclusion', value: 's2' },
  { label: 'Legacy S0 security', value: 's0' },
  { label: 'Insecure / no encryption', value: 'insecure' },
]

const phaseTone = computed(() => {
  if (state.value.phase === 'done') return 'ok'
  if (state.value.phase === 'error') return 'danger'
  if (state.value.phase === 'aborted') return 'warn'
  if (['starting', 'waiting', 'grant', 'validate-dsk', 'adding'].includes(state.value.phase)) return 'info'
  return 'idle'
})
const isRunning = computed(() => ['starting', 'waiting', 'grant', 'validate-dsk', 'adding'].includes(state.value.phase))
const addedNodeId = computed(() => state.value.node?.id)
const removedNodeId = computed(() => state.value.removedNode?.id ?? state.value.removedNode?.nodeId)
const canSaveDetails = computed(() => Boolean(addedNodeId.value && (name.value.trim() || location.value.trim())))

onMounted(() => {
  zwaveSocket.subscribe([Channel.controller, Channel.nodes])
  zwaveSocket.on(SocketEvent.controller, onController)
  zwaveSocket.on(SocketEvent.grantSecurityClasses, onGrant)
  zwaveSocket.on(SocketEvent.validateDSK, onValidate)
  zwaveSocket.on(SocketEvent.inclusionAborted, onAborted)
  zwaveSocket.on(SocketEvent.nodeAdded, onNodeAdded)
  zwaveSocket.on(SocketEvent.nodeRemoved, onNodeRemoved)
})

onBeforeUnmount(() => {
  zwaveSocket.off(SocketEvent.controller, onController)
  zwaveSocket.off(SocketEvent.grantSecurityClasses, onGrant)
  zwaveSocket.off(SocketEvent.validateDSK, onValidate)
  zwaveSocket.off(SocketEvent.inclusionAborted, onAborted)
  zwaveSocket.off(SocketEvent.nodeAdded, onNodeAdded)
  zwaveSocket.off(SocketEvent.nodeRemoved, onNodeRemoved)
  zwaveSocket.unsubscribe([Channel.controller, Channel.nodes])
  void cleanupController()
})

async function beginInclusion() {
  await runCommand('include', async () => {
    state.value = inclusionReducer(state.value, { type: 'start', mode: 'include', message: 'Starting inclusion…' })
    const response = await startInclusion(strategyForChoice(securityChoice.value))
    if (!response.success) throw new Error(response.message || 'Could not start inclusion')
    toast.info('Inclusion started. Put the device in pairing mode.')
  })
}

async function beginExclusion() {
  await runCommand('exclude', async () => {
    state.value = inclusionReducer(state.value, { type: 'start', mode: 'exclude', message: 'Starting exclusion…' })
    const response = await startExclusion()
    if (!response.success) throw new Error(response.message || 'Could not start exclusion')
    toast.info('Exclusion started. Put the device in exclusion mode.')
  })
}

async function beginReplace() {
  const nodeId = Number(replaceNodeId.value)
  if (!Number.isInteger(nodeId) || nodeId <= 0) {
    toast.warning('Enter a valid failed node ID.')
    return
  }
  const ok = await confirm({
    title: `Replace failed node ${nodeId}?`,
    message: 'This starts inclusion for a replacement device while keeping the failed node ID. Continue only when the old node is failed.',
    confirmText: 'Start replace',
    danger: true,
  })
  if (!ok) return

  await runCommand('replace', async () => {
    state.value = inclusionReducer(state.value, { type: 'start', mode: 'replace', message: `Starting replacement for node ${nodeId}…` })
    const response = await replaceFailedNode(nodeId, strategyForChoice(securityChoice.value))
    if (!response.success) throw new Error(response.message || 'Could not start replacement')
    toast.info('Replacement started. Put the new device in inclusion mode.')
  })
}

async function stopCurrent() {
  busy.value = true
  try {
    if (state.value.mode === 'exclude') await stopExclusion()
    else {
      await abortInclusion()
      await stopInclusion()
    }
    state.value = inclusionReducer(state.value, { type: 'aborted', payload: { message: 'Stopped by user.' } })
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not stop controller command')
  } finally {
    busy.value = false
  }
}

async function submitGrant(grant: SecurityClassGrant) {
  busy.value = true
  try {
    const response = await grantSecurityClasses(grant)
    if (!response.success) throw new Error(response.message || 'Could not grant security classes')
    state.value = { ...state.value, phase: 'adding', message: 'Security classes sent. Waiting for the device…' }
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}

async function submitDsk(dsk: string) {
  busy.value = true
  try {
    const response = await validateDSK(dsk)
    if (!response.success) throw new Error(response.message || 'Could not validate DSK')
    state.value = { ...state.value, phase: 'adding', message: 'DSK accepted. Finishing inclusion…' }
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}

async function saveDetails() {
  const id = addedNodeId.value
  if (!id) return
  busy.value = true
  try {
    const updates = []
    if (name.value.trim()) updates.push(setNodeName(id, name.value.trim()))
    if (location.value.trim()) updates.push(setNodeLocation(id, location.value.trim()))
    const results = await Promise.all(updates)
    const failed = results.find((result) => !result.success)
    if (failed) throw new Error(failed.message || 'Could not save device details')
    toast.success('Device details saved')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not save device details')
  } finally {
    busy.value = false
  }
}

function reset(mode: InclusionMode = 'include') {
  state.value = initialInclusionState(mode)
  name.value = ''
  location.value = ''
}

async function runCommand(mode: InclusionMode, command: () => Promise<void>) {
  busy.value = true
  state.value = initialInclusionState(mode)
  try {
    await command()
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : 'Controller command failed'
  state.value = inclusionReducer(state.value, { type: 'apiError', error: message })
  toast.error(message)
}

function onController(payload: unknown) {
  state.value = inclusionReducer(state.value, { type: 'controller', payload: payload as never })
}
function onGrant(payload: unknown) {
  state.value = inclusionReducer(state.value, { type: 'grant', payload })
}
function onValidate(payload: unknown) {
  state.value = inclusionReducer(state.value, { type: 'validateDSK', payload })
}
function onAborted(payload: unknown) {
  state.value = inclusionReducer(state.value, { type: 'aborted', payload })
}
function onNodeAdded(payload: unknown) {
  state.value = inclusionReducer(state.value, { type: 'nodeAdded', payload })
  const node = state.value.node as ZwaveNode | undefined
  name.value = node?.name ?? ''
  location.value = node?.loc ?? ''
  toast.success(`Node ${node?.id ?? ''} added`.trim())
}
function onNodeRemoved(payload: unknown) {
  state.value = inclusionReducer(state.value, { type: 'nodeRemoved', payload })
  toast.success(`Node ${removedNodeId.value ?? ''} removed`.trim())
}

async function cleanupController() {
  if (state.value.phase === 'idle' || isInclusionDone(state.value)) return
  try {
    if (state.value.mode === 'exclude') await stopExclusion()
    else {
      await abortInclusion()
      await stopInclusion()
    }
  } catch {
    // Best-effort cleanup on navigation; the backend may already be idle.
  }
}
</script>

<template>
  <div class="classic-inclusion">
    <section class="hero card">
      <div>
        <BaseBadge variant="primary">Classic add</BaseBadge>
        <h2>Add or remove a Z-Wave device</h2>
        <p>Use this manual flow when you do not have a SmartStart QR code. Secure S2 is recommended and selected by default.</p>
      </div>
      <div class="status-pill">
        <StatusDot :status="phaseTone" :pulse="isRunning" />
        <span>{{ state.message }}</span>
      </div>
    </section>

    <section class="grid">
      <div class="card flow-card">
        <div class="step-heading">
          <span class="step-num">1</span>
          <div>
            <h3>Choose security</h3>
            <p>S2 is best for modern devices. Use insecure only for legacy devices that cannot pair securely.</p>
          </div>
        </div>
        <BaseSelect v-model="securityChoice" label="Inclusion security" :options="securityOptions" :disabled="isRunning || busy" />
      </div>

      <div class="card flow-card">
        <div class="step-heading">
          <span class="step-num">2</span>
          <div>
            <h3>Start inclusion</h3>
            <p>After starting, put the device in pairing mode (often pressing its button 3 times).</p>
          </div>
        </div>
        <div class="actions">
          <BaseButton size="lg" :loading="busy && state.mode === 'include'" :disabled="isRunning" @click="beginInclusion">Start inclusion</BaseButton>
          <BaseButton v-if="isRunning && state.mode !== 'exclude'" variant="danger" size="lg" :loading="busy" @click="stopCurrent">Cancel / stop</BaseButton>
        </div>
      </div>
    </section>

    <S2GrantClasses
      v-if="state.phase === 'grant' && state.grant"
      :request="state.grant"
      :busy="busy"
      @submit="submitGrant"
      @abort="stopCurrent"
    />
    <S2ValidateDsk
      v-if="state.phase === 'validate-dsk' && state.dsk"
      :request="state.dsk"
      :busy="busy"
      @submit="submitDsk"
      @abort="stopCurrent"
    />

    <section v-if="state.phase === 'done' && addedNodeId" class="card success-card">
      <div>
        <BaseBadge variant="success">Added</BaseBadge>
        <h3>Node {{ addedNodeId }} joined the network</h3>
        <p>Name it now so it is easy to find on the dashboard.</p>
      </div>
      <div class="name-grid">
        <BaseTextField v-model="name" label="Name" placeholder="Kitchen light" :disabled="busy" />
        <BaseTextField v-model="location" label="Room" placeholder="Kitchen" :disabled="busy" />
      </div>
      <div class="actions">
        <BaseButton :disabled="!canSaveDetails" :loading="busy" @click="saveDetails">Save name & room</BaseButton>
        <RouterLink :to="{ name: 'device-detail', params: { id: addedNodeId } }" class="detail-link">Open device</RouterLink>
        <BaseButton variant="secondary" @click="reset()">Add another</BaseButton>
      </div>
    </section>

    <section class="grid">
      <div class="card flow-card">
        <div class="step-heading">
          <span class="step-num">−</span>
          <div>
            <h3>Exclude a device</h3>
            <p>Remove any Z-Wave device from this or another network. Put it in exclusion mode after starting.</p>
          </div>
        </div>
        <div v-if="state.phase === 'done' && removedNodeId" class="result-line">Removed node {{ removedNodeId }}.</div>
        <div class="actions">
          <BaseButton variant="secondary" :loading="busy && state.mode === 'exclude'" :disabled="isRunning" @click="beginExclusion">Start exclusion</BaseButton>
          <BaseButton v-if="isRunning && state.mode === 'exclude'" variant="danger" :loading="busy" @click="stopCurrent">Stop exclusion</BaseButton>
        </div>
      </div>

      <AdvancedOnly>
        <div class="card flow-card danger-zone">
          <div class="step-heading">
            <span class="step-num">!</span>
            <div>
              <h3>Replace failed node <BaseBadge variant="expert" size="sm">Advanced</BaseBadge></h3>
              <p>Swap a dead device while keeping its node ID. This is guarded because it changes the network.</p>
            </div>
          </div>
          <BaseTextField v-model="replaceNodeId" label="Failed node ID" placeholder="12" :disabled="isRunning || busy" />
          <div class="actions">
            <BaseButton variant="danger" :loading="busy && state.mode === 'replace'" :disabled="isRunning" @click="beginReplace">Replace failed node</BaseButton>
          </div>
        </div>
      </AdvancedOnly>
    </section>
  </div>
</template>

<style scoped>
.classic-inclusion {
  display: grid;
  gap: var(--s-5);
}
.card {
  padding: var(--s-5);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-1);
}
.hero {
  display: grid;
  gap: var(--s-4);
}
h2,
h3,
p {
  margin: 0;
}
h2,
h3 {
  color: var(--color-text);
}
p {
  color: var(--color-text-muted);
  line-height: 1.5;
}
.grid {
  display: grid;
  gap: var(--s-4);
}
.flow-card {
  display: grid;
  gap: var(--s-4);
  align-content: start;
}
.step-heading {
  display: flex;
  gap: var(--s-3);
  align-items: flex-start;
}
.step-heading > div {
  display: grid;
  gap: var(--s-2);
}
.step-num {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  flex: none;
  border-radius: var(--r-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
  font-weight: 800;
}
.status-pill,
.result-line {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  width: fit-content;
  padding: var(--s-2) var(--s-3);
  border-radius: var(--r-pill);
  background: var(--color-surface-2);
  color: var(--color-text);
  font-weight: 600;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-3);
}
.success-card {
  display: grid;
  gap: var(--s-4);
  border-color: var(--ok);
}
.name-grid {
  display: grid;
  gap: var(--s-3);
}
.detail-link {
  color: var(--color-primary-strong);
  font-weight: 700;
  text-decoration: none;
}
.detail-link:hover {
  text-decoration: underline;
}
.danger-zone {
  border-color: var(--danger);
}
@media (min-width: 760px) {
  .hero,
  .grid,
  .name-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .status-pill {
    justify-self: end;
    align-self: start;
  }
}
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Channel, SocketEvent, zwaveSocket, type CallApiResult } from '@/api'
import BaseBadge from '@/components/base/BaseBadge.vue'
import NvmCard from '@/components/controller/NvmCard.vue'
import OtwFirmwareCard from '@/components/controller/OtwFirmwareCard.vue'
import RebuildRoutesCard from '@/components/controller/RebuildRoutesCard.vue'
import RegionCard from '@/components/controller/RegionCard.vue'
import ResetCard from '@/components/controller/ResetCard.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { firmwareReducer, initialFirmwareState, parseUpdateResult, type FirmwareProgress, type FirmwareState } from '@/devices/firmware'
import {
  abortControllerFirmwareUpdate,
  backupNVMRaw,
  beginRebuildingRoutes,
  confirmationMatches,
  firmwareUpdateOTW,
  hardReset,
  initialRebuildProgressState,
  nvmBackupFilename,
  parseRebuildProgress,
  rebuildProgressReducer,
  restart,
  restoreNVM,
  setMaxLRPowerLevel,
  setPowerlevel,
  setRFRegion,
  shutdownZwaveAPI,
  softReset,
  stopRebuildingRoutes,
  type ControllerMaintenanceAction,
  type RebuildProgressState,
} from '@/network/controller-maintenance'
import { useControllerStore } from '@/stores/controller'
import { useNodesStore } from '@/stores/nodes'

const toast = useToast()
const { confirm, prompt } = useConfirm()
const controllerStore = useControllerStore()
const nodesStore = useNodesStore()
const { controllerNode } = storeToRefs(nodesStore)

const rebuild = ref<RebuildProgressState>(initialRebuildProgressState())
const firmwareState = ref<FirmwareState>(initialFirmwareState())
const busyAction = ref<string | null>(null)
const stoppingRebuild = ref(false)
const abortingFirmware = ref(false)

const isBusy = computed(() => busyAction.value !== null)
const controllerName = computed(() => controllerStore.homeName || controllerStore.info?.name || controllerNode.value?.name || '')
const typedTarget = computed(() => controllerName.value.trim() || 'ERASE')
const currentRegion = computed(() => fieldValue(['RFRegion', 'rfRegion', 'region']))
const powerlevel = computed(() => fieldValue(['powerlevel']))
const measured0dBm = computed(() => fieldValue(['measured0dBm']))
const maxLongRangePowerlevel = computed(() => fieldValue(['maxLongRangePowerlevel', 'maxLRPowerlevel']))
const canAbortFirmware = computed(() => typeof controllerNode.value?.id === 'number')

onMounted(() => {
  zwaveSocket.subscribe([Channel.rebuild, Channel.firmware])
  zwaveSocket.on(SocketEvent.rebuildRoutesProgress, handleRebuildProgress)
  zwaveSocket.on(SocketEvent.otwFirmwareUpdate, handleFirmwareEvent)
})

onBeforeUnmount(() => {
  zwaveSocket.off(SocketEvent.rebuildRoutesProgress, handleRebuildProgress)
  zwaveSocket.off(SocketEvent.otwFirmwareUpdate, handleFirmwareEvent)
  zwaveSocket.unsubscribe([Channel.rebuild, Channel.firmware])
  if (rebuild.value.phase === 'running') void stopRebuildingRoutes()
})

async function startRebuild() {
  if (!(await confirmDanger('Rebuild all routes?', 'This rebuilds routes for the entire network and may temporarily degrade routing.', 'Start rebuild'))) return
  rebuild.value = rebuildProgressReducer(rebuild.value, { type: 'start', total: nodesStore.devices.length })
  await runAction('rebuild-routes', () => beginRebuildingRoutes(), 'Rebuild routes started')
}

async function stopRebuild() {
  stoppingRebuild.value = true
  try {
    const response = await stopRebuildingRoutes()
    if (!response.success) throw new Error(response.message || 'Could not stop rebuilding routes')
    rebuild.value = rebuildProgressReducer(rebuild.value, { type: 'stop' })
    toast.warning('Rebuild routes stopped')
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    stoppingRebuild.value = false
  }
}

async function downloadNvmBackup() {
  busyAction.value = 'nvm-backup'
  try {
    const response = await backupNVMRaw()
    if (!response.success) throw new Error(response.message || 'NVM backup failed')
    const result = response.result ?? response
    const data = isRecord(result) ? result.data : result
    const bytes = bytesFrom(data)
    if (!bytes.byteLength) throw new Error('NVM backup returned no data')
    const fileName = isRecord(result) && typeof result.fileName === 'string' ? `${result.fileName}.bin` : nvmBackupFilename()
    downloadBytes(bytes, fileName)
    toast.success('NVM backup downloaded')
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    busyAction.value = null
  }
}

async function restoreNvmBackup(file: File) {
  if (!(await typedConfirmation('nvm-restore', 'Restore NVM backup?', `This overwrites controller NVM with ${file.name}. The wrong file can permanently break this network. Type ERASE to continue.`, 'ERASE'))) return
  const data = new Uint8Array(await file.arrayBuffer())
  await runAction('nvm-restore', () => restoreNVM(data), 'NVM restore started')
}

async function changeRegion(region: number) {
  if (!(await confirmDanger('Change RF region?', 'Devices may become unreachable and radio settings must match your local regulatory region.', 'Apply region'))) return
  await runAction('set-rf-region', () => setRFRegion(region), 'RF region updated')
}

async function changePowerlevel(power: number, measured: number) {
  if (!(await confirmDanger('Change powerlevel?', 'Incorrect power settings can reduce reliability or violate local regulations.', 'Apply powerlevel'))) return
  await runAction('set-powerlevel', () => setPowerlevel(power, measured), 'Powerlevel updated')
}

async function changeLongRangePowerlevel(power: number) {
  if (!(await confirmDanger('Change long range power?', 'Incorrect long range power settings can reduce reliability or violate local regulations.', 'Apply LR power'))) return
  await runAction('set-max-lr-powerlevel', () => setMaxLRPowerLevel(power), 'Long range power updated')
}

async function updateControllerFirmware(file: File) {
  if (!(await confirmDanger('Update controller firmware?', `Upload ${file.name} to the controller. Do not power off the controller, radio stick, or host until the update completes.`, 'Start update'))) return
  firmwareState.value = firmwareReducer(firmwareState.value, { type: 'start' })
  busyAction.value = 'controller-otw-firmware'
  try {
    const response = await firmwareUpdateOTW({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) })
    const result = parseUpdateResult(response)
    firmwareState.value = firmwareReducer(firmwareState.value, result.success ? { type: 'success', result } : { type: 'error', error: result.message })
    if (result.success) toast.success('Controller firmware update completed')
    else toast.error(result.message)
  } catch (error) {
    const message = messageFrom(error)
    firmwareState.value = firmwareReducer(firmwareState.value, { type: 'error', error: message })
    toast.error(message)
  } finally {
    busyAction.value = null
  }
}

async function abortFirmware() {
  if (!controllerNode.value?.id) return toast.warning('Controller node is not available; abort cannot be sent.')
  if (!(await confirmDanger('Abort controller firmware update?', 'Abort only if the update is stalled or unsafe to continue.', 'Abort update'))) return
  abortingFirmware.value = true
  try {
    const response = await abortControllerFirmwareUpdate(controllerNode.value.id)
    if (!response.success) throw new Error(response.message || 'Could not abort firmware update')
    firmwareState.value = firmwareReducer(firmwareState.value, { type: 'aborted' })
    toast.warning('Firmware update abort requested')
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    abortingFirmware.value = false
  }
}

async function softResetController() {
  if (!(await confirmDanger('Soft reset controller?', 'The controller chip will restart; the network may be unavailable briefly.', 'Soft reset'))) return
  await runAction('soft-reset', () => softReset(), 'Soft reset sent')
}

async function restartDriver() {
  if (!(await confirmDanger('Restart Z-Wave driver?', 'The driver connection will restart and devices may be unavailable briefly.', 'Restart'))) return
  await runAction('restart', () => restart(), 'Restart requested')
}

async function shutdownApi() {
  if (!(await confirmDanger('Shutdown Z-Wave API?', 'The controller may require a manual unplug/replug before it can be used again.', 'Shutdown'))) return
  await runAction('shutdown-zwave-api', () => shutdownZwaveAPI(), 'Z-Wave API shutdown requested')
}

async function hardResetController() {
  if (!(await typedConfirmation('hard-reset', 'Factory hard reset controller?', `This erases the controller network. Every included device will be orphaned and must be excluded or factory reset. Type ${typedTarget.value} to continue.`, typedTarget.value))) return
  await runAction('hard-reset', () => hardReset(), 'Hard reset requested')
}

function handleRebuildProgress(payload: unknown) {
  const event = parseRebuildProgress(payload)
  if (event) rebuild.value = rebuildProgressReducer(rebuild.value, event)
}

function handleFirmwareEvent(payload: unknown) {
  const event = isRecord(payload) ? payload : {}
  if (isRecord(event.progress)) firmwareState.value = firmwareReducer(firmwareState.value, { type: 'progress', progress: event.progress as FirmwareProgress })
  if (event.result) {
    const result = parseUpdateResult(event.result)
    firmwareState.value = firmwareReducer(firmwareState.value, result.success ? { type: 'success', result } : { type: 'error', error: result.message })
  }
}

async function runAction(action: ControllerMaintenanceAction, call: () => Promise<CallApiResult<unknown>>, successMessage: string) {
  busyAction.value = action
  try {
    const response = await call()
    if (!response.success) throw new Error(response.message || `${successMessage} failed`)
    toast.success(successMessage)
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    busyAction.value = null
  }
}

function confirmDanger(title: string, message: string, confirmText: string) {
  return confirm({ title, message, confirmText, danger: true })
}

async function typedConfirmation(action: ControllerMaintenanceAction, title: string, message: string, expected: string): Promise<boolean> {
  const typed = await prompt({ title, message, confirmText: 'I understand', danger: true, input: { type: 'text', label: `Type ${expected} to continue` } })
  if (confirmationMatches(expected, typed)) return true
  if (typed !== null) toast.error(action === 'hard-reset' ? 'Hard reset confirmation did not match.' : 'NVM restore confirmation did not match.')
  return false
}

function fieldValue(keys: string[]): number | string | undefined {
  const sources = [controllerNode.value, controllerStore.info]
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const value = source[key]
      if (typeof value === 'number' || typeof value === 'string') return value
    }
  }
  return undefined
}

function bytesFrom(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (Array.isArray(value)) return new Uint8Array(value.filter((entry): entry is number => typeof entry === 'number'))
  if (isRecord(value) && Array.isArray(value.data)) return new Uint8Array(value.data.filter((entry): entry is number => typeof entry === 'number'))
  return new Uint8Array()
}

function downloadBytes(bytes: Uint8Array, fileName: string) {
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.bin') || fileName.endsWith('.nvm') ? fileName : `${fileName}.bin`
  link.click()
  URL.revokeObjectURL(url)
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Controller maintenance action failed'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}
</script>

<template>
  <main class="controller-maintenance">
    <header class="hero">
      <div>
        <div class="hero-title">
          <h1>Controller maintenance</h1>
          <BaseBadge variant="expert">Expert only</BaseBadge>
        </div>
        <p>Dangerous controller-level operations. Every destructive action requires confirmation; irreversible actions require typed confirmation.</p>
      </div>
    </header>

    <div class="grid">
      <RebuildRoutesCard :progress="rebuild" :disabled="isBusy" :loading="busyAction === 'rebuild-routes'" :stopping="stoppingRebuild" @start="startRebuild" @stop="stopRebuild" />
      <NvmCard :disabled="isBusy" :backup-loading="busyAction === 'nvm-backup'" :restore-loading="busyAction === 'nvm-restore'" @backup="downloadNvmBackup" @restore="restoreNvmBackup" />
      <RegionCard
        :current-region="currentRegion"
        :powerlevel="powerlevel"
        :measured0d-bm="measured0dBm"
        :max-long-range-powerlevel="maxLongRangePowerlevel"
        :disabled="isBusy"
        :loading="busyAction?.startsWith('set-')"
        @set-region="changeRegion"
        @set-powerlevel="changePowerlevel"
        @set-max-long-range="changeLongRangePowerlevel"
      />
      <OtwFirmwareCard
        :state="firmwareState"
        :disabled="isBusy"
        :loading="busyAction === 'controller-otw-firmware'"
        :aborting="abortingFirmware"
        :can-abort="canAbortFirmware"
        @update="updateControllerFirmware"
        @abort="abortFirmware"
      />
      <ResetCard class="wide" :disabled="isBusy" :busy-action="busyAction" @soft-reset="softResetController" @restart="restartDriver" @shutdown="shutdownApi" @hard-reset="hardResetController" />
    </div>
  </main>
</template>

<style scoped>
.controller-maintenance {
  display: grid;
  gap: var(--s-5);
}
.hero {
  display: flex;
  justify-content: space-between;
  gap: var(--s-4);
  padding: var(--s-5);
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  border-radius: var(--r-lg);
}
.hero-title {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  flex-wrap: wrap;
}
h1,
p {
  margin: 0;
}
.hero p {
  margin-top: var(--s-2);
  color: var(--color-text-muted);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s-5);
}
.wide {
  grid-column: 1 / -1;
}
@media (max-width: 980px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>

import { zwaveSocket, type CallApiResult } from '@/api'

export const RF_REGIONS = [
  { label: 'Europe', value: 0 },
  { label: 'USA', value: 1 },
  { label: 'Australia/New Zealand', value: 2 },
  { label: 'Hong Kong', value: 3 },
  { label: 'India', value: 5 },
  { label: 'Israel', value: 6 },
  { label: 'Russia', value: 7 },
  { label: 'China', value: 8 },
  { label: 'USA (Long Range)', value: 9 },
  { label: 'Europe (Long Range)', value: 11 },
  { label: 'Japan', value: 32 },
  { label: 'Korea', value: 33 },
  { label: 'Unknown', value: 254, disabled: true },
  { label: 'Default (EU)', value: 255, disabled: true },
] as const

export type RFRegionValue = (typeof RF_REGIONS)[number]['value']

export const CONTROLLER_MAINTENANCE_ACTIONS = [
  'rebuild-routes',
  'stop-rebuild-routes',
  'nvm-backup',
  'nvm-restore',
  'set-rf-region',
  'set-powerlevel',
  'set-max-lr-powerlevel',
  'controller-otw-firmware',
  'soft-reset',
  'hard-reset',
  'restart',
  'shutdown-zwave-api',
] as const

export type ControllerMaintenanceAction = (typeof CONTROLLER_MAINTENANCE_ACTIONS)[number]

export type RebuildRouteStatus = 'pending' | 'done' | 'failed' | 'skipped' | string
export type RebuildPhase = 'idle' | 'running' | 'complete' | 'stopped' | 'error'

export interface RebuildNodeProgress {
  nodeId: number
  status: RebuildRouteStatus
}

export interface RebuildProgressState {
  phase: RebuildPhase
  nodes: Record<number, RebuildNodeProgress>
  done: number
  total: number
  message?: string
}

export type RebuildProgressEvent =
  | { type: 'start'; total?: number }
  | { type: 'progress'; entries: RebuildNodeProgress[] }
  | { type: 'stop'; message?: string }
  | { type: 'error'; message: string }
  | { type: 'reset' }

export interface ControllerFirmwareFile {
  name: string
  data: Uint8Array
}

export interface RebuildRoutesOptions {
  [key: string]: unknown
}

export function initialRebuildProgressState(): RebuildProgressState {
  return { phase: 'idle', nodes: {}, done: 0, total: 0 }
}

export function parseRebuildProgress(payload: unknown): RebuildProgressEvent | null {
  const entries = normalizeEntries(payload)
  return entries.length ? { type: 'progress', entries } : null
}

export function rebuildProgressReducer(
  state: RebuildProgressState = initialRebuildProgressState(),
  event: RebuildProgressEvent,
): RebuildProgressState {
  if (event.type === 'reset') return initialRebuildProgressState()
  if (event.type === 'start') return { ...state, phase: 'running', total: event.total ?? state.total, message: undefined }
  if (event.type === 'stop') return { ...state, phase: 'stopped', message: event.message ?? 'Rebuild stopped' }
  if (event.type === 'error') return { ...state, phase: 'error', message: event.message }

  const nodes = { ...state.nodes }
  for (const entry of event.entries) nodes[entry.nodeId] = entry
  const list = Object.values(nodes)
  const done = list.filter((entry) => entry.status !== 'pending').length
  const total = Math.max(state.total, list.length)
  const complete = total > 0 && done >= total && list.every((entry) => entry.status !== 'pending')

  return {
    ...state,
    phase: complete ? 'complete' : 'running',
    nodes,
    done,
    total,
    message: complete ? 'Rebuild routes completed' : undefined,
  }
}

export function rebuildPercent(state: Pick<RebuildProgressState, 'done' | 'total'>): number {
  return state.total > 0 ? Math.round((state.done / state.total) * 100) : 0
}

export function requiresTypedConfirmation(action: ControllerMaintenanceAction): boolean {
  return action === 'hard-reset' || action === 'nvm-restore'
}

export function confirmationMatches(expected: string, typed: string | number | boolean | null | undefined): boolean {
  if (typeof typed !== 'string') return false
  const normalizedExpected = expected.trim()
  return normalizedExpected.length > 0 && typed.trim() === normalizedExpected
}

export function nvmBackupFilename(date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  return `zwave-controller-nvm-${stamp}.bin`
}

export function beginRebuildingRoutes(options?: RebuildRoutesOptions): Promise<CallApiResult<boolean>> {
  return options === undefined ? zwaveSocket.callApi('beginRebuildingRoutes') : zwaveSocket.callApi('beginRebuildingRoutes', options)
}

export function stopRebuildingRoutes(): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('stopRebuildingRoutes')
}

export function backupNVMRaw(): Promise<CallApiResult<{ data: unknown; fileName?: string }>> {
  return zwaveSocket.callApi('backupNVMRaw')
}

export function restoreNVM(buffer: Uint8Array, useRaw?: boolean): Promise<CallApiResult<unknown>> {
  return useRaw === undefined ? zwaveSocket.callApi('restoreNVM', buffer) : zwaveSocket.callApi('restoreNVM', buffer, useRaw)
}

export function setRFRegion(region: RFRegionValue | number): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('setRFRegion', region)
}

export function setPowerlevel(powerlevel: number, measured0dBm: number): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('setPowerlevel', powerlevel, measured0dBm)
}

export function setMaxLRPowerLevel(maxPower: number): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('setMaxLRPowerLevel', maxPower)
}

export function firmwareUpdateOTW(file: ControllerFirmwareFile): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('firmwareUpdateOTW', file)
}

export function abortControllerFirmwareUpdate(controllerNodeId: number): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('abortFirmwareUpdate', controllerNodeId)
}

export function softReset(): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('softReset')
}

export function hardReset(): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('hardReset')
}

export function restart(): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('restart')
}

export function shutdownZwaveAPI(): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('shutdownZwaveAPI')
}

function normalizeEntries(payload: unknown): RebuildNodeProgress[] {
  if (Array.isArray(payload)) return payload.map(entryFromTuple).filter(isProgress)
  if (isRecord(payload)) {
    if (Array.isArray(payload.progress)) return normalizeEntries(payload.progress)
    if (Array.isArray(payload.entries)) return normalizeEntries(payload.entries)
    const nodeId = numberValue(payload.nodeId)
    if (nodeId !== undefined && typeof payload.status === 'string') return [{ nodeId, status: payload.status }]
    return Object.entries(payload)
      .map(([nodeId, status]) => entryFromTuple([Number(nodeId), status]))
      .filter(isProgress)
  }
  return []
}

function entryFromTuple(entry: unknown): RebuildNodeProgress | null {
  if (Array.isArray(entry)) {
    const nodeId = numberValue(entry[0])
    return nodeId !== undefined && typeof entry[1] === 'string' ? { nodeId, status: entry[1] } : null
  }
  if (isRecord(entry)) {
    const nodeId = numberValue(entry.nodeId)
    return nodeId !== undefined && typeof entry.status === 'string' ? { nodeId, status: entry.status } : null
  }
  return null
}

function isProgress(value: RebuildNodeProgress | null): value is RebuildNodeProgress {
  return value !== null
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(number) ? number : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

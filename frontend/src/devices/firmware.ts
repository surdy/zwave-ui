import { zwaveSocket, type CallApiResult, type ZwaveNode } from '@/api'

export const FIRMWARE_PHASES = [
  'idle',
  'checking',
  'available',
  'updating',
  'success',
  'error',
  'aborted',
] as const

export type FirmwarePhase = (typeof FIRMWARE_PHASES)[number]

export interface FirmwareUpdateInfo {
  version: string
  normalizedVersion?: string
  changelog?: string
  channel?: string
  downgrade?: boolean
  files?: { target?: number; integrity?: string; url?: string }[]
  device?: {
    manufacturerId?: number
    productType?: number
    productId?: number
    firmwareVersion?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface ManualFirmwareFile {
  name: string
  data: Uint8Array
  target?: number
}

export interface FirmwareProgress {
  nodeId?: number
  currentFile?: number
  totalFiles?: number
  sentFragments?: number
  totalFragments?: number
  progress?: number
  status?: string
  [key: string]: unknown
}

export interface ParsedUpdateResult {
  success: boolean
  message: string
  status?: string | number
  waitTime?: number
  reInterview?: boolean
}

export interface FirmwareState {
  phase: FirmwarePhase
  percent: number
  status: string
  updates: FirmwareUpdateInfo[]
  result?: ParsedUpdateResult
  error?: string
}

export type FirmwareEvent =
  | { type: 'check' }
  | { type: 'available'; updates: FirmwareUpdateInfo[] }
  | { type: 'start' }
  | { type: 'progress'; progress: FirmwareProgress }
  | { type: 'success'; result?: ParsedUpdateResult }
  | { type: 'error'; error: string }
  | { type: 'aborted'; message?: string }

export function initialFirmwareState(): FirmwareState {
  return {
    phase: 'idle',
    percent: 0,
    status: 'Idle',
    updates: [],
  }
}

export function firmwareReducer(state: FirmwareState, event: FirmwareEvent): FirmwareState {
  switch (event.type) {
    case 'check':
      return { ...state, phase: 'checking', status: 'Checking for updates…', error: undefined }
    case 'available':
      return {
        ...state,
        phase: 'available',
        updates: event.updates,
        status: event.updates.length ? `${event.updates.length} update(s) available` : 'No updates available',
        error: undefined,
      }
    case 'start':
      return { ...state, phase: 'updating', percent: 0, status: 'Firmware update starting…', result: undefined, error: undefined }
    case 'progress':
      return applyProgress(state, event.progress)
    case 'success':
      return {
        ...state,
        phase: 'success',
        percent: 100,
        status: event.result?.message || 'Firmware update completed',
        result: event.result,
        error: undefined,
      }
    case 'error':
      return { ...state, phase: 'error', status: event.error, error: event.error }
    case 'aborted':
      return { ...state, phase: 'aborted', status: event.message || 'Firmware update aborted' }
  }
}

export function applyProgress(state: FirmwareState, progress: FirmwareProgress): FirmwareState {
  const percent = progressPercent(progress)
  return {
    ...state,
    phase: 'updating',
    percent,
    status: progress.status || progressStatus(progress, percent),
    error: undefined,
  }
}

export function progressPercent(progress: FirmwareProgress): number {
  const explicit = finiteNumber(progress.progress)
  if (explicit !== undefined) return clampPercent(explicit)

  const sent = finiteNumber(progress.sentFragments)
  const total = finiteNumber(progress.totalFragments)
  const currentFile = finiteNumber(progress.currentFile)
  const totalFiles = finiteNumber(progress.totalFiles)

  if (sent !== undefined && total && currentFile && totalFiles) {
    const completedFiles = Math.max(0, currentFile - 1)
    return clampPercent(((completedFiles * total + sent) / (total * totalFiles)) * 100)
  }

  if (sent !== undefined && total) return clampPercent((sent / total) * 100)

  return 0
}

export function canStartUpdate(state: FirmwareState, node: Pick<ZwaveNode, 'available' | 'failed' | 'ready' | 'status'>): boolean {
  if (state.phase === 'updating' || state.phase === 'checking') return false
  if (node.failed || !node.ready || !node.available) return false
  return node.status !== 'Dead' && node.status !== 'Asleep'
}

export function parseUpdateResult(payload: unknown): ParsedUpdateResult {
  const envelope = record(payload)
  const result = record(envelope.result) || envelope
  const envelopeSuccess = typeof envelope.success === 'boolean' ? envelope.success : undefined
  const resultSuccess = typeof result.success === 'boolean' ? result.success : undefined
  const success = resultSuccess ?? envelopeSuccess ?? payload === true
  const status = typeof result.status === 'string' || typeof result.status === 'number' ? result.status : undefined
  const message =
    stringValue(envelope.message) ||
    stringValue(result.message) ||
    (status !== undefined ? `Firmware update status: ${String(status)}` : success ? 'Firmware update completed' : 'Firmware update failed')

  return {
    success,
    message,
    status,
    waitTime: finiteNumber(result.waitTime),
    reInterview: typeof result.reInterview === 'boolean' ? result.reInterview : undefined,
  }
}

export function getAvailableFirmwareUpdates(nodeId: number): Promise<CallApiResult<FirmwareUpdateInfo[]>> {
  return zwaveSocket.callApi('getAvailableFirmwareUpdates', nodeId)
}

export function getNodeFirmwareUpdates(nodeId: number): Promise<CallApiResult<FirmwareUpdateInfo[]>> {
  return zwaveSocket.callApi('getNodeFirmwareUpdates', nodeId)
}

export function firmwareUpdateOTA(nodeId: number, update: FirmwareUpdateInfo): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('firmwareUpdateOTA', nodeId, update)
}

export function updateFirmware(nodeId: number, files: ManualFirmwareFile[]): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('updateFirmware', nodeId, files)
}

export function abortFirmwareUpdate(nodeId: number): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('abortFirmwareUpdate', nodeId)
}

export function dismissFirmwareUpdate(nodeId: number, version?: string): Promise<CallApiResult<boolean>> {
  return version === undefined
    ? zwaveSocket.callApi('dismissFirmwareUpdate', nodeId)
    : zwaveSocket.callApi('dismissFirmwareUpdate', nodeId, version)
}

function progressStatus(progress: FirmwareProgress, percent: number): string {
  const file = finiteNumber(progress.currentFile)
  const totalFiles = finiteNumber(progress.totalFiles)
  const fragments = fragmentLabel(progress)
  const fileLabel = file && totalFiles ? ` · file ${file}/${totalFiles}` : ''
  return `Updating firmware: ${percent}%${fileLabel}${fragments}`
}

function fragmentLabel(progress: FirmwareProgress): string {
  const sent = finiteNumber(progress.sentFragments)
  const total = finiteNumber(progress.totalFragments)
  return sent !== undefined && total !== undefined ? ` · ${sent}/${total} fragments` : ''
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

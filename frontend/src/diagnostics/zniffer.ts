import { InboundEvent } from '@/api/events'
import { zwaveSocket } from '@/api/socket'
import type { CallApiResult } from '@/api/types'

export const ZNIFFER_API_NAMES = [
  'start',
  'stop',
  'clear',
  'getFrames',
  'setFrequency',
  'setLRChannelConfig',
  'saveCaptureToFile',
  'loadCaptureFromBuffer',
] as const

export type ZnifferApiName = (typeof ZNIFFER_API_NAMES)[number]

export type ZnifferApiPayload =
  | { apiName: 'start' | 'stop' | 'clear' | 'getFrames' | 'saveCaptureToFile' }
  | { apiName: 'setFrequency'; frequency: number }
  | { apiName: 'setLRChannelConfig'; channelConfig: number }
  | { apiName: 'loadCaptureFromBuffer'; buffer: ArrayBuffer | Uint8Array | number[] }

export interface ZnifferState {
  enabled?: boolean
  started?: boolean
  error?: string
  supportedFrequencies?: Record<string, string> | Map<number, string>
  frequency?: number
  region?: string | number
  lrRegions?: number[]
  supportedLRChannelConfigs?: Record<string, string>
  lrChannelConfig?: number
  [key: string]: unknown
}

export interface ZnifferFrame {
  id?: number | string
  timestamp?: number | string | Date
  homeId?: number | string
  channel?: number | string
  region?: string | number
  sourceNodeId?: number | string
  destinationNodeId?: number | string
  protocolDataRate?: string | number
  protocol?: string | number
  type?: string
  command?: string
  hop?: number | string
  direction?: string
  rssi?: number | string
  payload?: string | Uint8Array | number[] | ArrayBuffer | null
  raw?: string
  parsedPayload?: Record<string, unknown>
  corrupted?: boolean
  [key: string]: unknown
}

export interface ZnifferFilter {
  query?: string
  channel?: string | number
  node?: string | number
  corruptedOnly?: boolean
  type?: string
}

export interface WindowRange {
  start: number
  end: number
  padTop: number
  padBottom: number
}

export interface FrequencyOption {
  label: string
  value: number
}

export function callZniffer<T = unknown>(payload: ZnifferApiPayload): Promise<CallApiResult<T>> {
  return new Promise((resolve) => {
    const sock = zwaveSocket.raw
    if (!sock || !zwaveSocket.connected) return resolve({ success: false, message: 'Socket not connected' })
    sock.emit(InboundEvent.zniffer, payload, (response: CallApiResult<T>) => resolve(response))
  })
}

export function znifferStart() {
  return callZniffer({ apiName: 'start' })
}

export function znifferStop() {
  return callZniffer({ apiName: 'stop' })
}

export function znifferClear() {
  return callZniffer({ apiName: 'clear' })
}

export function znifferGetFrames() {
  return callZniffer<ZnifferFrame[]>({ apiName: 'getFrames' })
}

export function setFrequency(frequency: number) {
  return callZniffer({ apiName: 'setFrequency', frequency })
}

export function setLRChannelConfig(channelConfig: number) {
  return callZniffer({ apiName: 'setLRChannelConfig', channelConfig })
}

export function saveCapture() {
  return callZniffer({ apiName: 'saveCaptureToFile' })
}

export function loadCaptureFromBuffer(buffer: ArrayBuffer | Uint8Array | number[]) {
  return callZniffer({ apiName: 'loadCaptureFromBuffer', buffer })
}

export function appendFrames(buffer: readonly ZnifferFrame[], frames: readonly ZnifferFrame[], max: number): ZnifferFrame[] {
  if (max <= 0) return []
  if (frames.length === 0) return [...buffer]
  const next = [...buffer, ...frames]
  return next.length > max ? next.slice(next.length - max) : next
}

export function filterFrames(frames: readonly ZnifferFrame[], { query = '', channel = '', node = '', corruptedOnly = false, type = '' }: ZnifferFilter): ZnifferFrame[] {
  const normalizedQuery = String(query).trim().toLowerCase()
  const channelValue = String(channel).trim()
  const nodeValue = String(node).trim()
  const typeValue = String(type).trim().toLowerCase()

  return frames.filter((frame) => {
    if (corruptedOnly && !frame.corrupted) return false
    if (channelValue && String(frame.channel ?? '') !== channelValue && String(frame.region ?? '') !== channelValue) return false
    if (nodeValue && String(frame.sourceNodeId ?? '') !== nodeValue && String(frame.destinationNodeId ?? '') !== nodeValue) return false
    if (typeValue && ![frame.type, frame.command, frame.protocol].some((value) => String(value ?? '').toLowerCase() === typeValue)) return false
    if (!normalizedQuery) return true
    return searchableText(frame).includes(normalizedQuery)
  })
}

export function computeWindow(scrollTop: number, rowHeight: number, viewportH: number, total: number, overscan: number): WindowRange {
  const safeTotal = Math.max(0, Math.floor(total))
  const safeRowHeight = Math.max(1, rowHeight)
  const safeViewport = Math.max(0, viewportH)
  const safeOverscan = Math.max(0, Math.floor(overscan))
  const visibleCount = Math.ceil(safeViewport / safeRowHeight)
  const maxFirstVisible = Math.max(0, safeTotal - visibleCount)
  const firstVisible = Math.min(maxFirstVisible, Math.max(0, Math.floor(Math.max(0, scrollTop) / safeRowHeight)))
  const start = Math.max(0, firstVisible - safeOverscan)
  const end = Math.min(safeTotal, firstVisible + visibleCount + safeOverscan)

  return {
    start,
    end: Math.max(start, end),
    padTop: start * safeRowHeight,
    padBottom: Math.max(0, safeTotal - Math.max(start, end)) * safeRowHeight,
  }
}

export function formatFrameSummary(frame: ZnifferFrame): string {
  const route = `${valueOrDash(frame.sourceNodeId)}→${valueOrDash(frame.destinationNodeId)}`
  const type = String(frame.type ?? frame.command ?? frame.protocol ?? 'Frame')
  const rate = frame.protocolDataRate ? ` ${frame.protocolDataRate}` : ''
  const rssi = frame.rssi !== undefined ? ` RSSI ${frame.rssi}` : ''
  return `${route} ${type}${rate}${rssi}`.trim()
}

export function payloadToHex(payload: ZnifferFrame['payload']): string {
  if (payload == null) return ''
  if (typeof payload === 'string') return payload
  const bytes = payload instanceof ArrayBuffer ? new Uint8Array(payload) : payload instanceof Uint8Array ? payload : Uint8Array.from(payload)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ')
}

export function framesToBlob(frames: readonly ZnifferFrame[]): Blob {
  return new Blob([JSON.stringify(frames, null, 2)], { type: 'application/json;charset=utf-8' })
}

export function parseFrequencyOptions(state?: ZnifferState | null): FrequencyOption[] {
  const supported = state?.supportedFrequencies
  const entries = supported instanceof Map ? Array.from(supported.entries()) : Object.entries(supported ?? {}).map(([key, label]) => [Number(key), label] as const)
  const options = entries
    .filter(([value]) => Number.isFinite(value))
    .map(([value, label]) => ({ value, label: String(label || value) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  if (typeof state?.frequency === 'number' && !options.some((option) => option.value === state.frequency)) {
    options.unshift({ value: state.frequency, label: `Current (${state.frequency})` })
  }
  return options
}

function searchableText(frame: ZnifferFrame): string {
  return [
    frame.homeId,
    frame.channel,
    frame.region,
    frame.sourceNodeId,
    frame.destinationNodeId,
    frame.protocolDataRate,
    frame.protocol,
    frame.type,
    frame.command,
    frame.hop,
    frame.direction,
    frame.rssi,
    frame.payload,
    frame.raw,
    frame.corrupted ? 'corrupted' : '',
    frame.parsedPayload ? JSON.stringify(frame.parsedPayload) : '',
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(' ')
    .toLowerCase()
}

function valueOrDash(value: unknown): string {
  return value === undefined || value === null || value === '' ? '—' : String(value)
}

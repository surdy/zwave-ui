import { zwaveSocket, type CallApiResult, type ControllerStatusPayload, type ZwaveNode } from '@/api'

export const InclusionStrategy = {
  Default: 0,
  SmartStart: 1,
  Insecure: 2,
  Security_S0: 3,
  Security_S2: 4,
} as const

export type InclusionStrategyValue = (typeof InclusionStrategy)[keyof typeof InclusionStrategy]
export type InclusionChoice = 's2-default' | 's2' | 's0' | 'insecure'
export type InclusionPhase = 'idle' | 'starting' | 'waiting' | 'grant' | 'validate-dsk' | 'adding' | 'done' | 'aborted' | 'error'
export type InclusionMode = 'include' | 'exclude' | 'replace'

export interface SecurityClassGrant {
  securityClasses: number[]
  clientSideAuth: boolean
}

export type GrantRequest = SecurityClassGrant

export interface DskRequest {
  dsk: string
  pinLength: number
}

export interface InclusionState {
  phase: InclusionPhase
  mode: InclusionMode
  message: string
  controllerStatus?: string
  error?: string
  grant?: GrantRequest
  dsk?: DskRequest
  node?: ZwaveNode
  removedNode?: ZwaveNode | { id?: number; nodeId?: number }
}

export type InclusionEvent =
  | { type: 'start'; mode?: InclusionMode; message?: string }
  | { type: 'controller'; payload: ControllerStatusPayload | string }
  | { type: 'grant'; payload: unknown }
  | { type: 'validateDSK'; payload: unknown }
  | { type: 'aborted'; payload?: unknown }
  | { type: 'nodeAdded'; payload: unknown }
  | { type: 'nodeRemoved'; payload: unknown }
  | { type: 'apiError'; error: string }
  | { type: 'reset' }

const DEFAULT_PIN_LENGTH = 5

export function initialInclusionState(mode: InclusionMode = 'include'): InclusionState {
  return { phase: 'idle', mode, message: 'Ready' }
}

export function inclusionReducer(state: InclusionState, event: InclusionEvent): InclusionState {
  switch (event.type) {
    case 'start':
      return {
        ...state,
        mode: event.mode ?? state.mode,
        phase: 'starting',
        message: event.message ?? 'Starting controller command…',
        error: undefined,
        grant: undefined,
        dsk: undefined,
        node: undefined,
        removedNode: undefined,
      }
    case 'controller':
      return reduceControllerStatus(state, getStatusText(event.payload))
    case 'grant':
      return { ...state, phase: 'grant', message: 'Choose which security classes to grant.', grant: parseGrantRequest(event.payload) }
    case 'validateDSK':
      return { ...state, phase: 'validate-dsk', message: 'Enter the 5-digit DSK PIN from the device.', dsk: parseDskRequest(event.payload) }
    case 'aborted':
      return { ...state, phase: 'aborted', message: getAbortMessage(event.payload), grant: undefined, dsk: undefined }
    case 'nodeAdded':
      return { ...state, phase: 'done', message: 'Device added successfully.', node: parseNodeAdded(event.payload), grant: undefined, dsk: undefined }
    case 'nodeRemoved':
      return { ...state, phase: 'done', message: 'Device removed successfully.', removedNode: parseNodeRemoved(event.payload) }
    case 'apiError':
      return { ...state, phase: 'error', message: event.error, error: event.error }
    case 'reset':
      return initialInclusionState(state.mode)
  }
}

export function strategyForChoice(choice: InclusionChoice): InclusionStrategyValue {
  if (choice === 's2') return InclusionStrategy.Security_S2
  if (choice === 's0') return InclusionStrategy.Security_S0
  if (choice === 'insecure') return InclusionStrategy.Insecure
  return InclusionStrategy.Default
}

export function parseGrantRequest(payload: unknown): GrantRequest {
  const data = asRecord(payload)
  return {
    securityClasses: toNumberArray(data.securityClasses),
    clientSideAuth: Boolean(data.clientSideAuth),
  }
}

export function parseDskRequest(payload: unknown): DskRequest {
  if (typeof payload === 'string') return { dsk: payload, pinLength: DEFAULT_PIN_LENGTH }
  const data = asRecord(payload)
  const dsk = String(data.dsk ?? data.DSK ?? data.value ?? '')
  const pinLength = Number(data.pinLength ?? data.pinDigits ?? DEFAULT_PIN_LENGTH)
  return { dsk, pinLength: Number.isFinite(pinLength) && pinLength > 0 ? pinLength : DEFAULT_PIN_LENGTH }
}

export function isInclusionDone(state: InclusionState): boolean {
  return state.phase === 'done' || state.phase === 'aborted' || state.phase === 'error'
}

export function startInclusion(strategy: InclusionStrategyValue, options?: Record<string, unknown>): Promise<CallApiResult<boolean>> {
  return options ? zwaveSocket.callApi('startInclusion', strategy, options) : zwaveSocket.callApi('startInclusion', strategy)
}

export function stopInclusion(): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('stopInclusion')
}

export function startExclusion(): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('startExclusion')
}

export function stopExclusion(): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('stopExclusion')
}

export function replaceFailedNode(nodeId: number, strategy: InclusionStrategyValue): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('replaceFailedNode', nodeId, strategy)
}

export function grantSecurityClasses(grant: SecurityClassGrant): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('grantSecurityClasses', grant)
}

export function validateDSK(dsk: string): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('validateDSK', dsk)
}

export function abortInclusion(): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('abortInclusion')
}

function reduceControllerStatus(state: InclusionState, status: string): InclusionState {
  const normalized = status.toLowerCase()
  if (!status) return state
  if (normalized.includes('error') || normalized.includes('failed') || normalized.includes('fail')) {
    return { ...state, phase: 'error', message: status, controllerStatus: status, error: status }
  }
  if (normalized.includes('abort')) {
    return { ...state, phase: 'aborted', message: status, controllerStatus: status }
  }
  if (normalized.includes('started') || normalized.includes('start')) {
    return { ...state, phase: 'waiting', message: status, controllerStatus: status }
  }
  if (normalized.includes('stopped') || normalized.includes('stop')) {
    return { ...state, phase: 'adding', message: status, controllerStatus: status }
  }
  if (normalized.includes('inclusion') || normalized.includes('exclusion')) {
    return { ...state, phase: state.phase === 'idle' ? 'waiting' : state.phase, message: status, controllerStatus: status }
  }
  return { ...state, message: status, controllerStatus: status }
}

function getStatusText(payload: ControllerStatusPayload | string): string {
  if (typeof payload === 'string') return payload
  return String(payload.status ?? payload.error ?? payload.inclusionState ?? '')
}

function getAbortMessage(payload: unknown): string {
  const data = asRecord(payload)
  return String(data.reason ?? data.message ?? 'Inclusion aborted.')
}

function parseNodeAdded(payload: unknown): ZwaveNode | undefined {
  const data = asRecord(payload)
  const node = data.node ?? payload
  return node && typeof node === 'object' ? (node as ZwaveNode) : undefined
}

function parseNodeRemoved(payload: unknown): ZwaveNode | { id?: number; nodeId?: number } | undefined {
  const data = asRecord(payload)
  const node = data.node ?? payload
  return node && typeof node === 'object' ? (node as ZwaveNode | { id?: number; nodeId?: number }) : undefined
}

function toNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite)
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => Number(key))
      .filter(Number.isFinite)
  }
  return []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

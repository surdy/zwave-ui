/**
 * Types mirroring the zwave-js-ui backend contract.
 *
 * These are a curated subset of the upstream `ZUINode` / `ZUIValueId` shapes
 * (api/lib/ZwaveClient.ts). We model the fields the UI actually consumes and
 * keep index signatures off so the type checker stays useful; unknown extra
 * fields from the backend are simply ignored at runtime.
 *
 * Source of truth: docs/05-implementation/backend-api.md
 */

/** A single value reported by a node (ZUIValueId subset). */
export interface ValueId {
  id: string
  nodeId: number
  commandClass: number
  commandClassName?: string
  endpoint?: number
  property: number | string
  propertyKey?: number | string
  propertyName?: string
  propertyKeyName?: string
  type: 'number' | 'boolean' | 'string' | 'string[]' | 'number[]' | 'any' | 'duration' | 'color'
  readable: boolean
  writeable: boolean
  label?: string
  description?: string
  default?: unknown
  genre?: 'basic' | 'user' | 'system' | 'config' | 'count'
  min?: number
  max?: number
  step?: number
  unit?: string
  states?: { text: string; value: number | string | boolean }[]
  list?: boolean
  allowManualEntry?: boolean
  value?: unknown
  lastUpdate?: number
  stateless?: boolean
  commandClassVersion?: number
}

/** Device class descriptor. */
export interface DeviceClass {
  basic: number
  generic: number
  specific: number
}

/** Association group descriptor. */
export interface NodeGroup {
  title: string
  value: number
  endpoint: number
  maxNodes: number
  isLifeline: boolean
  multiChannel: boolean
}

/** A node on the network (ZUINode subset). */
export interface ZwaveNode {
  id: number
  name?: string
  loc?: string
  manufacturer?: string
  manufacturerId?: number
  productLabel?: string
  productDescription?: string
  productType?: number
  productId?: number
  firmwareVersion?: string
  deviceId?: string
  deviceClass?: DeviceClass
  isControllerNode?: boolean
  isListening?: boolean
  isFrequentListening?: boolean | string
  isRouting?: boolean
  isSecure?: boolean | 'unknown'
  security?: string
  supportsBeaming?: boolean
  keepAwake?: boolean
  status?: 'Unknown' | 'Asleep' | 'Awake' | 'Dead' | 'Alive'
  interviewStage?: string
  ready: boolean
  available: boolean
  failed: boolean
  inited: boolean
  lastActive?: number
  batteryLevel?: number
  minBatteryLevel?: number
  powerSource?: string
  zwavePlusVersion?: number
  protocolVersion?: string
  sdkVersion?: string
  endpointsCount?: number
  groups?: NodeGroup[]
  neighbors?: number[]
  values?: Record<string, ValueId>
  hexId?: string
  dbLink?: string
  statistics?: Record<string, unknown>
  /** Allow forward-compatible extra fields without defeating the checker elsewhere. */
  [extra: string]: unknown
}

/** Controller / app info (getInfo subset). */
export interface ControllerInfo {
  homeid?: number
  name?: string
  controllerId?: number
  status?: string
  appVersion?: string
  zwaveVersion?: string
  serverVersion?: string
  uptime?: number
  lastUpdate?: number
  cntStatus?: string
  inclusionState?: string
  newConfigVersion?: string
  [extra: string]: unknown
}

/** Controller command / status push (CONTROLLER_CMD). */
export interface ControllerStatusPayload {
  status?: string
  error?: string
  inclusionState?: string
  [extra: string]: unknown
}

/** Full state returned by the INITED handshake ack. */
export interface ZwaveState {
  nodes: ZwaveNode[]
  info?: ControllerInfo
  error?: string | false
  cntStatus?: string
  inclusionState?: string
  zniffer?: unknown
  debugCaptureActive?: boolean
}

/** Result envelope for a ZWAVE_API call. */
export interface CallApiResult<T = unknown> {
  success: boolean
  message: string
  result?: T
  args?: unknown[]
  api?: string
  code?: number
}

/** Connection lifecycle status surfaced to the UI. */
export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

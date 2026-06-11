/**
 * Pure device-domain helpers shared by the dashboard, device list, and device
 * detail screens. Everything here is a pure function of the node data so it can
 * be unit tested with fixtures and reused everywhere.
 */
import type { ValueId, ZwaveNode } from '@/api'
import { CommandClass } from './commandClasses'

export type DeviceStatus = 'ready' | 'asleep' | 'dead' | 'failed' | 'unknown'

export type DeviceKind =
  | 'switch'
  | 'dimmer'
  | 'cover'
  | 'lock'
  | 'sensor'
  | 'thermostat'
  | 'controller'
  | 'device'

/** Human-friendly display name with sensible fallbacks. */
export function deviceName(node: ZwaveNode): string {
  return (
    (node.name && node.name.trim()) ||
    (node.productLabel && node.productLabel.trim()) ||
    (node.productDescription && node.productDescription.trim()) ||
    `Node ${node.id}`
  )
}

/** Room / location, or a stable label for unassigned devices. */
export function deviceLocation(node: ZwaveNode): string {
  return (node.loc && node.loc.trim()) || 'Unassigned'
}

/** Coarse health/status used for badges and filtering. */
export function deviceStatus(node: ZwaveNode): DeviceStatus {
  if (node.failed) return 'failed'
  switch (node.status) {
    case 'Dead':
      return 'dead'
    case 'Asleep':
      return 'asleep'
    case 'Alive':
    case 'Awake':
      return 'ready'
    default:
      return node.ready ? 'ready' : 'unknown'
  }
}

/** Asleep battery devices are healthy; only dead/failed are "offline". */
export function isOffline(node: ZwaveNode): boolean {
  const s = deviceStatus(node)
  return s === 'dead' || s === 'failed'
}

export interface BatteryInfo {
  level: number
  low: boolean
}

/**
 * Battery reading for battery-powered devices, else null.
 *
 * zwave-js-ui exposes battery as `minBatteryLevel` (the minimum across a node's
 * endpoints, derived from the Battery CC `level` value) — it does not send a
 * single `batteryLevel` field. We read `minBatteryLevel` first and keep
 * `batteryLevel` as a fallback for forward-compatibility.
 */
export function batteryInfo(node: ZwaveNode): BatteryInfo | null {
  const level = [node.minBatteryLevel, node.batteryLevel].find(
    (v): v is number => typeof v === 'number',
  )
  if (level === undefined) return null
  return { level, low: level <= 20 }
}

function values(node: ZwaveNode): ValueId[] {
  return node.values ? Object.values(node.values) : []
}

function findValue(
  node: ZwaveNode,
  cc: number,
  property: ValueId['property'],
  need: 'readable' | 'writeable',
): ValueId | undefined {
  return values(node).find(
    (v) =>
      v.commandClass === cc &&
      v.property === property &&
      (need === 'readable' ? v.readable : v.writeable),
  )
}

export type ControlKind = 'switch' | 'dimmer' | 'cover' | 'lock'

export interface PrimaryControl {
  kind: ControlKind
  /** Current-state value (read), if exposed. */
  read?: ValueId
  /** Target value to actuate (write). */
  write: ValueId
  /** Value that means "on/open/locked". */
  onValue: number | boolean
  /** Value that means "off/closed/unlocked". */
  offValue: number | boolean
}

/**
 * The single most relevant quick-action control for a node, used for the card
 * toggle. Richer per-command-class controls live in the device-detail screen.
 */
export function primaryControl(node: ZwaveNode): PrimaryControl | null {
  // Binary switch
  const binWrite = findValue(node, CommandClass.BinarySwitch, 'targetValue', 'writeable')
  if (binWrite) {
    return {
      kind: 'switch',
      read: findValue(node, CommandClass.BinarySwitch, 'currentValue', 'readable'),
      write: binWrite,
      onValue: true,
      offValue: false,
    }
  }
  // Multilevel switch (dimmer)
  const mlWrite = findValue(node, CommandClass.MultilevelSwitch, 'targetValue', 'writeable')
  if (mlWrite) {
    return {
      kind: 'dimmer',
      read: findValue(node, CommandClass.MultilevelSwitch, 'currentValue', 'readable'),
      write: mlWrite,
      onValue: 99,
      offValue: 0,
    }
  }
  // Window covering (cover) — first writeable target.
  const coverWrite = values(node).find(
    (v) => v.commandClass === CommandClass.WindowCovering && v.property === 'targetValue' && v.writeable,
  )
  if (coverWrite) {
    const read = values(node).find(
      (v) =>
        v.commandClass === CommandClass.WindowCovering &&
        v.property === 'currentValue' &&
        v.readable &&
        v.propertyKey === coverWrite.propertyKey,
    )
    return { kind: 'cover', read, write: coverWrite, onValue: 99, offValue: 0 }
  }
  // Door lock
  const lockWrite = findValue(node, CommandClass.DoorLock, 'targetMode', 'writeable')
  if (lockWrite) {
    return {
      kind: 'lock',
      read: findValue(node, CommandClass.DoorLock, 'currentMode', 'readable'),
      write: lockWrite,
      onValue: 255,
      offValue: 0,
    }
  }
  return null
}

/** Whether a control's current value reads as on/open/locked. */
export function controlIsOn(control: PrimaryControl, currentValue: unknown): boolean {
  if (control.kind === 'switch') return currentValue === true
  if (control.kind === 'lock') return currentValue === control.onValue
  // dimmer / cover: any positive level is "on/open"
  return typeof currentValue === 'number' && currentValue > 0
}

function hasSensor(node: ZwaveNode): boolean {
  return values(node).some(
    (v) =>
      v.commandClass === CommandClass.BinarySensor ||
      v.commandClass === CommandClass.MultilevelSensor ||
      v.commandClass === CommandClass.Notification,
  )
}

/** Best-guess device category, primarily from its controllable capability. */
export function deviceKind(node: ZwaveNode): DeviceKind {
  if (node.isControllerNode) return 'controller'
  const control = primaryControl(node)
  if (control) return control.kind
  if (values(node).some((v) => v.commandClass === CommandClass.ThermostatSetpoint)) {
    return 'thermostat'
  }
  if (hasSensor(node)) return 'sensor'
  return 'device'
}

const KIND_ICON: Record<DeviceKind, string> = {
  switch: '🔌',
  dimmer: '💡',
  cover: '🪟',
  lock: '🔒',
  sensor: '📡',
  thermostat: '🌡️',
  controller: '🛰️',
  device: '📦',
}

export function deviceIcon(node: ZwaveNode): string {
  return KIND_ICON[deviceKind(node)]
}

/** Anything the user should act on: dead, failed, or low battery. */
export function needsAttention(node: ZwaveNode): boolean {
  if (isOffline(node)) return true
  const battery = batteryInfo(node)
  return Boolean(battery?.low)
}

// ---------------------------------------------------------------------------
// List reducers: search / filter / sort / group
// ---------------------------------------------------------------------------

export function searchDevices(nodes: ZwaveNode[], query: string): ZwaveNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  return nodes.filter((n) => {
    const haystack = [
      deviceName(n),
      deviceLocation(n),
      n.manufacturer ?? '',
      n.productLabel ?? '',
      n.productDescription ?? '',
      String(n.id),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export interface DeviceFilter {
  status?: DeviceStatus | 'all'
  location?: string | 'all'
  kind?: DeviceKind | 'all'
  needsAttention?: boolean
}

export function filterDevices(nodes: ZwaveNode[], filter: DeviceFilter): ZwaveNode[] {
  return nodes.filter((n) => {
    if (filter.status && filter.status !== 'all' && deviceStatus(n) !== filter.status) {
      return false
    }
    if (filter.location && filter.location !== 'all' && deviceLocation(n) !== filter.location) {
      return false
    }
    if (filter.kind && filter.kind !== 'all' && deviceKind(n) !== filter.kind) {
      return false
    }
    if (filter.needsAttention && !needsAttention(n)) return false
    return true
  })
}

/** Distinct device kinds present, in a stable display order. */
export function deviceKinds(nodes: ZwaveNode[]): DeviceKind[] {
  const order: DeviceKind[] = [
    'switch',
    'dimmer',
    'cover',
    'lock',
    'sensor',
    'thermostat',
    'controller',
    'device',
  ]
  const present = new Set(nodes.map(deviceKind))
  return order.filter((k) => present.has(k))
}

export type DeviceSort = 'name' | 'location' | 'status' | 'id' | 'lastSeen'

const STATUS_ORDER: Record<DeviceStatus, number> = {
  failed: 0,
  dead: 1,
  unknown: 2,
  asleep: 3,
  ready: 4,
}

export function sortDevices(nodes: ZwaveNode[], sort: DeviceSort): ZwaveNode[] {
  const copy = [...nodes]
  switch (sort) {
    case 'name':
      return copy.sort((a, b) => deviceName(a).localeCompare(deviceName(b)))
    case 'location':
      return copy.sort(
        (a, b) =>
          deviceLocation(a).localeCompare(deviceLocation(b)) ||
          deviceName(a).localeCompare(deviceName(b)),
      )
    case 'status':
      return copy.sort((a, b) => STATUS_ORDER[deviceStatus(a)] - STATUS_ORDER[deviceStatus(b)])
    case 'lastSeen':
      return copy.sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0))
    case 'id':
    default:
      return copy.sort((a, b) => a.id - b.id)
  }
}

export interface RoomGroup {
  location: string
  devices: ZwaveNode[]
}

/** Group devices by location, sorted alphabetically with "Unassigned" last. */
export function groupByRoom(nodes: ZwaveNode[]): RoomGroup[] {
  const map = new Map<string, ZwaveNode[]>()
  for (const n of nodes) {
    const loc = deviceLocation(n)
    const bucket = map.get(loc)
    if (bucket) bucket.push(n)
    else map.set(loc, [n])
  }
  return [...map.entries()]
    .map(([location, devices]) => ({ location, devices }))
    .sort((a, b) => {
      if (a.location === 'Unassigned') return 1
      if (b.location === 'Unassigned') return -1
      return a.location.localeCompare(b.location)
    })
}

/** Distinct, sorted list of room names present in the given nodes. */
export function roomNames(nodes: ZwaveNode[]): string[] {
  return groupByRoom(nodes).map((g) => g.location)
}

import { describe, it, expect } from 'vitest'
import type { ValueId, ZwaveNode } from '@/api'
import { CommandClass } from '../commandClasses'
import {
  batteryInfo,
  controlIsOn,
  deviceIcon,
  deviceKind,
  deviceKinds,
  deviceLocation,
  deviceName,
  deviceStatus,
  filterDevices,
  groupByRoom,
  isOffline,
  needsAttention,
  primaryControl,
  roomNames,
  searchDevices,
  sortDevices,
} from '../model'

function val(p: Partial<ValueId> & { commandClass: number; property: number | string }): ValueId {
  return {
    id: `${p.nodeId ?? 1}-${p.commandClass}-${p.endpoint ?? 0}-${p.property}${p.propertyKey != null ? `-${p.propertyKey}` : ''}`,
    nodeId: 1,
    type: 'any',
    readable: true,
    writeable: false,
    ...p,
  } as ValueId
}

function node(p: Partial<ZwaveNode> & { id: number }): ZwaveNode {
  const { values: vals, ...rest } = p
  const record: Record<string, ValueId> = {}
  if (vals) for (const k of Object.keys(vals)) record[k] = vals[k]
  return {
    ready: true,
    available: true,
    failed: false,
    inited: true,
    values: record,
    ...rest,
  } as ZwaveNode
}

function withValues(id: number, list: ValueId[], extra: Partial<ZwaveNode> = {}): ZwaveNode {
  const values: Record<string, ValueId> = {}
  for (const v of list) values[v.id] = { ...v, nodeId: id, id: v.id.replace(/^\d+/, String(id)) }
  return node({ id, values, ...extra })
}

describe('deviceName', () => {
  it('prefers user name, then product label, then description, then Node N', () => {
    expect(deviceName(node({ id: 2, name: 'Porch Light' }))).toBe('Porch Light')
    expect(deviceName(node({ id: 2, productLabel: 'ZW Switch' }))).toBe('ZW Switch')
    expect(deviceName(node({ id: 2, productDescription: 'Wall plug' }))).toBe('Wall plug')
    expect(deviceName(node({ id: 7 }))).toBe('Node 7')
  })
})

describe('deviceLocation', () => {
  it('returns the room or Unassigned', () => {
    expect(deviceLocation(node({ id: 1, loc: 'Kitchen' }))).toBe('Kitchen')
    expect(deviceLocation(node({ id: 1, loc: '  ' }))).toBe('Unassigned')
    expect(deviceLocation(node({ id: 1 }))).toBe('Unassigned')
  })
})

describe('deviceStatus / isOffline', () => {
  it('maps backend status and failed flag', () => {
    expect(deviceStatus(node({ id: 1, failed: true, status: 'Alive' }))).toBe('failed')
    expect(deviceStatus(node({ id: 1, status: 'Dead' }))).toBe('dead')
    expect(deviceStatus(node({ id: 1, status: 'Asleep' }))).toBe('asleep')
    expect(deviceStatus(node({ id: 1, status: 'Alive' }))).toBe('ready')
    expect(deviceStatus(node({ id: 1, status: 'Awake' }))).toBe('ready')
    expect(deviceStatus(node({ id: 1, status: 'Unknown', ready: false }))).toBe('unknown')
  })

  it('treats only dead/failed as offline', () => {
    expect(isOffline(node({ id: 1, status: 'Dead' }))).toBe(true)
    expect(isOffline(node({ id: 1, failed: true }))).toBe(true)
    expect(isOffline(node({ id: 1, status: 'Asleep' }))).toBe(false)
    expect(isOffline(node({ id: 1, status: 'Alive' }))).toBe(false)
  })
})

describe('batteryInfo / needsAttention', () => {
  it('reports battery level and low flag', () => {
    expect(batteryInfo(node({ id: 1 }))).toBeNull()
    expect(batteryInfo(node({ id: 1, batteryLevel: 80 }))).toEqual({ level: 80, low: false })
    expect(batteryInfo(node({ id: 1, batteryLevel: 15 }))).toEqual({ level: 15, low: true })
  })

  it('flags offline or low-battery devices', () => {
    expect(needsAttention(node({ id: 1, status: 'Alive', batteryLevel: 90 }))).toBe(false)
    expect(needsAttention(node({ id: 1, status: 'Dead' }))).toBe(true)
    expect(needsAttention(node({ id: 1, batteryLevel: 10 }))).toBe(true)
  })
})

describe('primaryControl / controlIsOn', () => {
  it('detects a binary switch', () => {
    const n = withValues(3, [
      val({ commandClass: CommandClass.BinarySwitch, property: 'currentValue', readable: true }),
      val({ commandClass: CommandClass.BinarySwitch, property: 'targetValue', writeable: true }),
    ])
    const c = primaryControl(n)
    expect(c?.kind).toBe('switch')
    expect(controlIsOn(c!, true)).toBe(true)
    expect(controlIsOn(c!, false)).toBe(false)
  })

  it('detects a dimmer (multilevel switch)', () => {
    const n = withValues(3, [
      val({ commandClass: CommandClass.MultilevelSwitch, property: 'currentValue', readable: true }),
      val({ commandClass: CommandClass.MultilevelSwitch, property: 'targetValue', writeable: true }),
    ])
    const c = primaryControl(n)
    expect(c?.kind).toBe('dimmer')
    expect(c?.onValue).toBe(99)
    expect(controlIsOn(c!, 40)).toBe(true)
    expect(controlIsOn(c!, 0)).toBe(false)
  })

  it('detects a window covering, matching current/target by propertyKey', () => {
    const n = withValues(3, [
      val({ commandClass: CommandClass.WindowCovering, property: 'currentValue', propertyKey: 13, readable: true }),
      val({ commandClass: CommandClass.WindowCovering, property: 'targetValue', propertyKey: 13, writeable: true }),
    ])
    const c = primaryControl(n)
    expect(c?.kind).toBe('cover')
    expect(c?.read?.propertyKey).toBe(13)
    expect(controlIsOn(c!, 50)).toBe(true)
    expect(controlIsOn(c!, 0)).toBe(false)
  })

  it('detects a door lock', () => {
    const n = withValues(3, [
      val({ commandClass: CommandClass.DoorLock, property: 'currentMode', readable: true }),
      val({ commandClass: CommandClass.DoorLock, property: 'targetMode', writeable: true }),
    ])
    const c = primaryControl(n)
    expect(c?.kind).toBe('lock')
    expect(c?.onValue).toBe(255)
    expect(controlIsOn(c!, 255)).toBe(true)
    expect(controlIsOn(c!, 0)).toBe(false)
  })

  it('returns null when there is no controllable capability', () => {
    expect(primaryControl(node({ id: 3 }))).toBeNull()
  })
})

describe('deviceKind / deviceIcon', () => {
  it('classifies controller, switch, sensor, thermostat and generic device', () => {
    expect(deviceKind(node({ id: 1, isControllerNode: true }))).toBe('controller')

    const sw = withValues(2, [
      val({ commandClass: CommandClass.BinarySwitch, property: 'targetValue', writeable: true }),
    ])
    expect(deviceKind(sw)).toBe('switch')

    const sensor = withValues(3, [
      val({ commandClass: CommandClass.MultilevelSensor, property: 'Air temperature', readable: true }),
    ])
    expect(deviceKind(sensor)).toBe('sensor')

    const thermostat = withValues(4, [
      val({ commandClass: CommandClass.ThermostatSetpoint, property: 'setpoint', readable: true }),
    ])
    expect(deviceKind(thermostat)).toBe('thermostat')

    expect(deviceKind(node({ id: 5 }))).toBe('device')
  })

  it('returns an emoji icon for every node', () => {
    expect(deviceIcon(node({ id: 1, isControllerNode: true }))).toBeTruthy()
    expect(deviceIcon(node({ id: 2 }))).toBeTruthy()
  })
})

describe('searchDevices', () => {
  const nodes = [
    node({ id: 2, name: 'Kitchen Light', manufacturer: 'Aeotec' }),
    node({ id: 3, name: 'Front Door Lock', loc: 'Entry' }),
  ]

  it('returns all when the query is empty', () => {
    expect(searchDevices(nodes, '   ')).toHaveLength(2)
  })

  it('matches name, manufacturer, location and id (case-insensitive)', () => {
    expect(searchDevices(nodes, 'kitchen').map((n) => n.id)).toEqual([2])
    expect(searchDevices(nodes, 'aeotec').map((n) => n.id)).toEqual([2])
    expect(searchDevices(nodes, 'entry').map((n) => n.id)).toEqual([3])
    expect(searchDevices(nodes, '3').map((n) => n.id)).toEqual([3])
  })
})

describe('filterDevices', () => {
  const nodes = [
    node({ id: 2, status: 'Alive', loc: 'Kitchen', batteryLevel: 90 }),
    node({ id: 3, status: 'Dead', loc: 'Entry' }),
    node({ id: 4, status: 'Asleep', loc: 'Kitchen', batteryLevel: 10 }),
  ]

  it('filters by status', () => {
    expect(filterDevices(nodes, { status: 'dead' }).map((n) => n.id)).toEqual([3])
    expect(filterDevices(nodes, { status: 'all' })).toHaveLength(3)
  })

  it('filters by location', () => {
    expect(filterDevices(nodes, { location: 'Kitchen' }).map((n) => n.id)).toEqual([2, 4])
  })

  it('filters by needs-attention', () => {
    expect(filterDevices(nodes, { needsAttention: true }).map((n) => n.id).sort()).toEqual([3, 4])
  })
})

describe('filterDevices by kind / deviceKinds', () => {
  const sw = withValues(2, [
    val({ commandClass: CommandClass.BinarySwitch, property: 'targetValue', writeable: true }),
  ])
  const lock = withValues(3, [
    val({ commandClass: CommandClass.DoorLock, property: 'targetMode', writeable: true }),
  ])
  const plain = node({ id: 4 })
  const nodes = [sw, lock, plain]

  it('filters by device kind', () => {
    expect(filterDevices(nodes, { kind: 'switch' }).map((n) => n.id)).toEqual([2])
    expect(filterDevices(nodes, { kind: 'lock' }).map((n) => n.id)).toEqual([3])
    expect(filterDevices(nodes, { kind: 'all' })).toHaveLength(3)
  })

  it('lists distinct kinds in display order', () => {
    expect(deviceKinds(nodes)).toEqual(['switch', 'lock', 'device'])
  })
})

describe('sortDevices', () => {
  const nodes = [
    node({ id: 4, name: 'Bravo', loc: 'Office', status: 'Dead', lastActive: 100 }),
    node({ id: 2, name: 'Alpha', loc: 'Attic', status: 'Alive', lastActive: 300 }),
    node({ id: 3, name: 'Charlie', loc: 'Bedroom', status: 'Asleep', lastActive: 200 }),
  ]

  it('sorts by id by default', () => {
    expect(sortDevices(nodes, 'id').map((n) => n.id)).toEqual([2, 3, 4])
  })

  it('sorts by name', () => {
    expect(sortDevices(nodes, 'name').map((n) => n.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('sorts by location', () => {
    expect(sortDevices(nodes, 'location').map((n) => n.loc)).toEqual(['Attic', 'Bedroom', 'Office'])
  })

  it('sorts by status worst-first', () => {
    expect(sortDevices(nodes, 'status').map((n) => n.id)).toEqual([4, 3, 2])
  })

  it('sorts by last seen most-recent-first', () => {
    expect(sortDevices(nodes, 'lastSeen').map((n) => n.id)).toEqual([2, 3, 4])
  })

  it('does not mutate the input array', () => {
    const input = [...nodes]
    sortDevices(input, 'name')
    expect(input.map((n) => n.id)).toEqual([4, 2, 3])
  })
})

describe('groupByRoom / roomNames', () => {
  const nodes = [
    node({ id: 2, loc: 'Kitchen' }),
    node({ id: 3 }),
    node({ id: 4, loc: 'Bedroom' }),
    node({ id: 5, loc: 'Kitchen' }),
  ]

  it('groups by room with Unassigned last', () => {
    const groups = groupByRoom(nodes)
    expect(groups.map((g) => g.location)).toEqual(['Bedroom', 'Kitchen', 'Unassigned'])
    expect(groups.find((g) => g.location === 'Kitchen')?.devices.map((n) => n.id)).toEqual([2, 5])
  })

  it('lists distinct room names', () => {
    expect(roomNames(nodes)).toEqual(['Bedroom', 'Kitchen', 'Unassigned'])
  })
})

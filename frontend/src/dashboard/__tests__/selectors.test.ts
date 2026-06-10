import { describe, expect, it } from 'vitest'
import type { ValueId, ZwaveNode } from '@/api'
import { CommandClass } from '@/devices/commandClasses'
import { attentionItems, networkSummary, roomSummaries } from '../selectors'

function node(extra: Partial<ZwaveNode> & { id: number }): ZwaveNode {
  return {
    ready: true,
    available: true,
    failed: false,
    inited: true,
    ...extra,
  } as ZwaveNode
}

function value(extra: Partial<ValueId> & { commandClass: number; property: string }): ValueId {
  return {
    id: `${extra.commandClass}-${extra.property}`,
    nodeId: 1,
    type: 'any',
    readable: true,
    writeable: false,
    ...extra,
  } as ValueId
}

function switchNode(id: number, loc: string): ZwaveNode {
  const write = value({
    id: `${id}-37-targetValue`,
    nodeId: id,
    commandClass: CommandClass.BinarySwitch,
    property: 'targetValue',
    writeable: true,
  })
  return node({ id, loc, values: { [write.id]: write } })
}

describe('dashboard selectors', () => {
  it('groups devices by room with counts and controllable counts', () => {
    const rooms = roomSummaries([
      switchNode(2, 'Kitchen'),
      node({ id: 3, loc: 'Kitchen' }),
      node({ id: 4, loc: 'Bedroom' }),
    ])

    expect(rooms.map((room) => [room.location, room.count, room.controllableCount])).toEqual([
      ['Bedroom', 1, 0],
      ['Kitchen', 2, 1],
    ])
  })

  it('selects devices needing attention', () => {
    const items = attentionItems([
      node({ id: 2, status: 'Alive', batteryLevel: 90 }),
      node({ id: 3, status: 'Dead' }),
      node({ id: 4, batteryLevel: 10 }),
      node({ id: 5, firmwareUpdateAvailable: true }),
    ])

    expect(items.map((item) => item.node.id)).toEqual([3, 4, 5])
    expect(items.find((item) => item.node.id === 4)?.reasons).toContain('Battery 10%')
    expect(items.find((item) => item.node.id === 5)?.reasons).toContain('Firmware update')
  })

  it('summarizes network device and controller status', () => {
    const summary = networkSummary(
      [node({ id: 2, status: 'Alive' }), node({ id: 3, status: 'Asleep' }), node({ id: 4, status: 'Dead' })],
      { status: 'connected', controllerStatus: 'driver ready' },
    )

    expect(summary).toEqual({
      totalDevices: 3,
      onlineCount: 2,
      controllerStatus: 'driver ready',
    })
  })
})

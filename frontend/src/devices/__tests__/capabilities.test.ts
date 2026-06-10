import { describe, expect, it } from 'vitest'
import type { ValueId, ZwaveNode } from '@/api'
import { CommandClass } from '../commandClasses'
import { capabilityGroups, displayValue, writableValues } from '../capabilities'

function val(p: Partial<ValueId> & { commandClass: number; property: number | string }): ValueId {
  return {
    id: `${p.nodeId ?? 1}-${p.commandClass}-${p.endpoint ?? 0}-${p.property}${p.propertyKey != null ? `-${p.propertyKey}` : ''}`,
    nodeId: p.nodeId ?? 1,
    endpoint: p.endpoint ?? 0,
    type: p.type ?? 'number',
    readable: p.readable ?? true,
    writeable: p.writeable ?? false,
    ...p,
  }
}

function node(values: ValueId[], id = 1): ZwaveNode {
  return {
    id,
    ready: true,
    available: true,
    failed: false,
    inited: true,
    values: Object.fromEntries(values.map((v) => [v.id, { ...v, nodeId: id }])),
  }
}

function widgets(values: ValueId[]) {
  return capabilityGroups(node(values)).flatMap((g) => g.widgets)
}

describe('capabilityGroups', () => {
  it('maps a binary switch to a toggle', () => {
    const [widget] = widgets([
      val({ commandClass: CommandClass.BinarySwitch, property: 'currentValue', type: 'boolean', value: false }),
      val({ commandClass: CommandClass.BinarySwitch, property: 'targetValue', type: 'boolean', writeable: true }),
    ])
    expect(widget.kind).toBe('toggle')
    expect(widget.read?.property).toBe('currentValue')
    expect(widget.write?.property).toBe('targetValue')
  })

  it('maps a multilevel switch to a slider driven by metadata', () => {
    const [widget] = widgets([
      val({ commandClass: CommandClass.MultilevelSwitch, property: 'currentValue', value: 40, unit: '%' }),
      val({ commandClass: CommandClass.MultilevelSwitch, property: 'targetValue', writeable: true, min: 0, max: 99, step: 1, unit: '%' }),
    ])
    expect(widget.kind).toBe('slider')
    expect(widget.min).toBe(0)
    expect(widget.max).toBe(99)
    expect(widget.unit).toBe('%')
  })

  it('maps thermostat setpoint and mode controls', () => {
    const groups = capabilityGroups(
      node([
        val({ commandClass: CommandClass.ThermostatSetpoint, property: 'setpoint', writeable: true, min: 7, max: 30, unit: '°C' }),
        val({
          commandClass: CommandClass.ThermostatMode,
          property: 'mode',
          writeable: true,
          states: [
            { text: 'Off', value: 0 },
            { text: 'Heat', value: 1 },
          ],
        }),
      ]),
    )
    expect(groups.flatMap((g) => g.widgets).map((w) => w.kind)).toEqual(['thermostat', 'thermostat'])
    expect(groups.flatMap((g) => g.widgets).find((w) => w.write?.commandClass === CommandClass.ThermostatSetpoint)?.max).toBe(30)
  })

  it('maps sensor and meter values to read-only displays with units', () => {
    const result = widgets([
      val({ commandClass: CommandClass.MultilevelSensor, property: 'Air temperature', value: 21.5, unit: '°C' }),
      val({ commandClass: CommandClass.Meter, property: 'Electric_kWh', value: 3.2, unit: 'kWh' }),
    ])
    expect(result.map((w) => w.kind)).toEqual(['display', 'display'])
    expect(displayValue(result[0].value)).toBe('21.5 °C')
  })

  it('maps door locks to lock/unlock widgets from states', () => {
    const [widget] = widgets([
      val({ commandClass: CommandClass.DoorLock, property: 'currentMode', value: 255 }),
      val({
        commandClass: CommandClass.DoorLock,
        property: 'targetMode',
        writeable: true,
        states: [
          { text: 'Unsecured', value: 0 },
          { text: 'Secured', value: 255 },
        ],
      }),
    ])
    expect(widget.kind).toBe('lock')
    expect(widget.onValue).toBe(255)
    expect(widget.offValue).toBe(0)
  })

  it('maps window coverings to position controls matching current and target by endpoint/key', () => {
    const [widget] = widgets([
      val({ commandClass: CommandClass.WindowCovering, endpoint: 2, property: 'currentValue', propertyKey: 13, value: 42 }),
      val({ commandClass: CommandClass.WindowCovering, endpoint: 2, property: 'targetValue', propertyKey: 13, writeable: true, min: 0, max: 99 }),
    ])
    expect(widget.kind).toBe('cover')
    expect(widget.read?.property).toBe('currentValue')
    expect(widget.max).toBe(99)
  })

  it('groups multi-endpoint devices with endpoint labels', () => {
    const groups = capabilityGroups(
      node([
        val({ commandClass: CommandClass.BinarySwitch, endpoint: 1, property: 'targetValue', type: 'boolean', writeable: true }),
        val({ commandClass: CommandClass.BinarySwitch, endpoint: 2, property: 'targetValue', type: 'boolean', writeable: true }),
      ]),
    )
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.label)).toEqual(['Endpoint 1 · Binary Switch', 'Endpoint 2 · Binary Switch'])
  })

  it('surfaces writable raw values for the advanced all-values editor', () => {
    const values = [
      val({ commandClass: 999, property: 'raw', writeable: true }),
      val({ commandClass: 999, property: 'read', writeable: false }),
    ]
    expect(writableValues(node(values))).toHaveLength(1)
  })
})

import type { ValueId, ZwaveNode } from '@/api'
import { CommandClass } from './commandClasses'

export type CapabilityWidgetKind =
  | 'toggle'
  | 'slider'
  | 'color'
  | 'thermostat'
  | 'cover'
  | 'lock'
  | 'display'
  | 'event'
  | 'notification'
  | 'raw'

export interface CapabilityWidget {
  id: string
  kind: CapabilityWidgetKind
  label: string
  value?: ValueId
  read?: ValueId
  write?: ValueId
  mode?: ValueId
  fanMode?: ValueId
  min?: number
  max?: number
  step?: number
  unit?: string
  onValue?: unknown
  offValue?: unknown
  values: ValueId[]
}

export interface CapabilityGroup {
  id: string
  label: string
  endpoint: number
  commandClass: number
  commandClassName: string
  widgets: CapabilityWidget[]
  values: ValueId[]
}

const CC_LABELS: Record<number, string> = {
  [CommandClass.BinarySwitch]: 'Binary Switch',
  [CommandClass.MultilevelSwitch]: 'Multilevel Switch',
  [CommandClass.BinarySensor]: 'Binary Sensor',
  [CommandClass.MultilevelSensor]: 'Multilevel Sensor',
  [CommandClass.Meter]: 'Meter',
  [CommandClass.Color]: 'Color Switch',
  [CommandClass.ThermostatSetpoint]: 'Thermostat',
  [CommandClass.ThermostatMode]: 'Thermostat Mode',
  [CommandClass.ThermostatFanMode]: 'Thermostat Fan',
  [CommandClass.CentralScene]: 'Central Scene',
  [CommandClass.DoorLock]: 'Door Lock',
  [CommandClass.BarrierOperator]: 'Barrier Operator',
  [CommandClass.WindowCovering]: 'Window Covering',
  [CommandClass.Notification]: 'Notification',
}

const SENSOR_CCS = new Set<number>([CommandClass.BinarySensor, CommandClass.MultilevelSensor, CommandClass.Meter])
const COVER_CCS = new Set<number>([CommandClass.WindowCovering, CommandClass.BarrierOperator])

function valueList(node: ZwaveNode): ValueId[] {
  return Object.values(node.values ?? {}).sort(compareValues)
}

function compareValues(a: ValueId, b: ValueId): number {
  return (
    (a.endpoint ?? 0) - (b.endpoint ?? 0) ||
    a.commandClass - b.commandClass ||
    String(a.property).localeCompare(String(b.property)) ||
    String(a.propertyKey ?? '').localeCompare(String(b.propertyKey ?? ''))
  )
}

function prop(v: ValueId): string {
  return String(v.property).toLowerCase()
}

function key(v: ValueId): string {
  return `${String(v.propertyKey ?? '')}:${v.endpoint ?? 0}`
}

function label(v: ValueId): string {
  return v.label || v.propertyName || v.propertyKeyName || String(v.property)
}

function ccName(values: ValueId[], cc: number): string {
  return values.find((v) => v.commandClassName)?.commandClassName || CC_LABELS[cc] || `Command Class ${cc}`
}

function range(v?: ValueId): Pick<CapabilityWidget, 'min' | 'max' | 'step' | 'unit'> {
  return { min: v?.min, max: v?.max, step: v?.step, unit: v?.unit }
}

function find(values: ValueId[], property: string, writable?: boolean): ValueId | undefined {
  return values.find((v) => prop(v) === property.toLowerCase() && (writable == null || v.writeable === writable))
}

function currentFor(values: ValueId[], target: ValueId): ValueId | undefined {
  return values.find((v) => prop(v) === 'currentvalue' && v.readable && key(v) === key(target))
}

function stateLabel(v: ValueId, value: unknown = v.value): string {
  const state = v.states?.find((s) => s.value === value)
  if (state) return state.text
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}

function widgetId(kind: CapabilityWidgetKind, v: ValueId): string {
  return `${kind}:${v.id}`
}

function switchWidgets(values: ValueId[]): CapabilityWidget[] {
  const target = find(values, 'targetValue', true)
  const current = find(values, 'currentValue')
  const source = target ?? current
  if (!source) return values.map(displayWidget)
  if (!target) return [displayWidget(source)]
  return [
    {
      id: widgetId('toggle', target),
      kind: 'toggle',
      label: label(target),
      read: current,
      write: target,
      values: [target, ...(current ? [current] : [])],
      onValue: true,
      offValue: false,
    },
  ]
}

function multilevelWidgets(values: ValueId[]): CapabilityWidget[] {
  const target = find(values, 'targetValue', true)
  const current = find(values, 'currentValue')
  const source = target ?? current
  if (!source) return values.map(displayWidget)
  if (!target) return [displayWidget(source)]
  return [
    {
      id: widgetId('slider', target),
      kind: 'slider',
      label: label(target),
      read: current,
      write: target,
      values: [target, ...(current ? [current] : [])],
      onValue: target.max ?? 99,
      offValue: target.min ?? 0,
      ...range(target),
    },
  ]
}

function colorWidgets(values: ValueId[]): CapabilityWidget[] {
  const writable = values.find((v) => v.writeable && (v.type === 'color' || prop(v).includes('color')))
  const readable = values.find((v) => v.readable && (v.type === 'color' || prop(v).includes('color')))
  const source = writable ?? readable ?? values[0]
  if (!source) return []
  return [
    source.writeable
      ? { id: widgetId('color', source), kind: 'color', label: label(source), read: readable, write: source, values: [source] }
      : displayWidget(source),
  ]
}

function thermostatWidgets(values: ValueId[]): CapabilityWidget[] {
  const widgets: CapabilityWidget[] = []
  for (const setpoint of values.filter((v) => v.commandClass === CommandClass.ThermostatSetpoint)) {
    widgets.push(
      setpoint.writeable
        ? {
            id: widgetId('thermostat', setpoint),
            kind: 'thermostat',
            label: label(setpoint),
            read: setpoint.readable ? setpoint : undefined,
            write: setpoint,
            values: [setpoint],
            ...range(setpoint),
          }
        : displayWidget(setpoint),
    )
  }
  for (const mode of values.filter(
    (v) => v.commandClass === CommandClass.ThermostatMode || v.commandClass === CommandClass.ThermostatFanMode,
  )) {
    widgets.push(mode.writeable ? selectWidget(mode, mode.commandClass === CommandClass.ThermostatFanMode ? 'Fan mode' : 'Mode') : displayWidget(mode))
  }
  return widgets
}

function coverWidgets(values: ValueId[]): CapabilityWidget[] {
  const targets = values.filter((v) => prop(v) === 'targetvalue' && v.writeable)
  if (!targets.length) return values.filter((v) => v.readable).map(displayWidget)
  return targets.map((target) => {
    const read = currentFor(values, target)
    return {
      id: widgetId('cover', target),
      kind: 'cover',
      label: label(target),
      read,
      write: target,
      values: [target, ...(read ? [read] : [])],
      onValue: target.max ?? 99,
      offValue: target.min ?? 0,
      ...range(target),
    }
  })
}

function lockWidgets(values: ValueId[]): CapabilityWidget[] {
  const target = find(values, 'targetMode', true) ?? values.find((v) => v.writeable && prop(v).includes('mode'))
  const current = find(values, 'currentMode') ?? values.find((v) => v.readable && prop(v).includes('mode'))
  const source = target ?? current
  if (!source) return values.map(displayWidget)
  if (!target) return [displayWidget(source)]
  return [
    {
      id: widgetId('lock', target),
      kind: 'lock',
      label: label(target),
      read: current,
      write: target,
      values: [target, ...(current ? [current] : [])],
      onValue: target.states?.find((s) => /^(secured|locked)$/i.test(s.text) || /\block/i.test(s.text))?.value ?? 255,
      offValue: target.states?.find((s) => /unsecure|unlock/i.test(s.text))?.value ?? 0,
    },
  ]
}

function selectWidget(value: ValueId, fallbackLabel?: string): CapabilityWidget {
  return {
    id: widgetId('thermostat', value),
    kind: 'thermostat',
    label: fallbackLabel ?? label(value),
    read: value.readable ? value : undefined,
    write: value,
    values: [value],
    ...range(value),
  }
}

function displayWidget(value: ValueId): CapabilityWidget {
  const kind: CapabilityWidgetKind = value.commandClass === CommandClass.Notification ? 'notification' : 'display'
  return { id: widgetId(kind, value), kind, label: label(value), value, values: [value], unit: value.unit }
}

function eventWidget(value: ValueId): CapabilityWidget {
  return { id: widgetId('event', value), kind: 'event', label: label(value), value, values: [value] }
}

function widgetsFor(cc: number, values: ValueId[]): CapabilityWidget[] {
  if (cc === CommandClass.BinarySwitch) return switchWidgets(values)
  if (cc === CommandClass.MultilevelSwitch) return multilevelWidgets(values)
  if (cc === CommandClass.Color) return colorWidgets(values)
  if (
    cc === CommandClass.ThermostatSetpoint ||
    cc === CommandClass.ThermostatMode ||
    cc === CommandClass.ThermostatFanMode
  ) {
    return thermostatWidgets(values)
  }
  if (COVER_CCS.has(cc)) return coverWidgets(values)
  if (cc === CommandClass.DoorLock) return lockWidgets(values)
  if (SENSOR_CCS.has(cc)) return values.filter((v) => v.readable).map(displayWidget)
  if (cc === CommandClass.CentralScene) return values.filter((v) => v.readable).map(eventWidget)
  if (cc === CommandClass.Notification) return values.filter((v) => v.readable).map(displayWidget)
  return values.map((v) => (v.writeable ? { ...displayWidget(v), kind: 'raw' } : displayWidget(v)))
}

export function capabilityGroups(node: ZwaveNode): CapabilityGroup[] {
  const buckets = new Map<string, ValueId[]>()
  for (const value of valueList(node)) {
    const endpoint = value.endpoint ?? 0
    const bucket = `${endpoint}:${value.commandClass}`
    const list = buckets.get(bucket)
    if (list) list.push(value)
    else buckets.set(bucket, [value])
  }

  return [...buckets.entries()].map(([id, values]) => {
    const endpoint = values[0]?.endpoint ?? 0
    const commandClass = values[0]?.commandClass ?? 0
    const commandClassName = ccName(values, commandClass)
    return {
      id,
      endpoint,
      commandClass,
      commandClassName,
      label: endpoint > 0 ? `Endpoint ${endpoint} · ${commandClassName}` : commandClassName,
      values,
      widgets: widgetsFor(commandClass, values),
    }
  })
}

export function displayValue(value?: ValueId): string {
  if (!value) return '—'
  const base = stateLabel(value)
  return value.unit && base !== '—' ? `${base} ${value.unit}` : base
}

export function writableValues(node: ZwaveNode): ValueId[] {
  return valueList(node).filter((v) => v.writeable)
}

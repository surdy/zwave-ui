import { zwaveSocket, type CallApiResult, type ValueId, type ZwaveNode } from '@/api'
import { refreshValues, writeValue } from '@/devices/control'

export { refreshValues, writeValue }

export const CONFIGURATION_COMMAND_CLASS = 112

export type ConfigEditorKind = 'enum' | 'number' | 'bool' | 'bitmask'

export interface ConfigParam {
  id: string
  property: ValueId['property']
  propertyKey?: ValueId['propertyKey']
  number: string
  label: string
  description?: string
  valueId: ValueId
  partials: ValueId[]
  values: ValueId[]
  readable: boolean
  writeable: boolean
  modified: boolean
  advanced: boolean
}

export function getDeviceConfigurationParams(id: number): Promise<CallApiResult> {
  return zwaveSocket.callApi('getDeviceConfigurationParams', id)
}

export function configParams(node: ZwaveNode): ConfigParam[] {
  const values = Object.values(node.values ?? {}).filter((value) => value.commandClass === CONFIGURATION_COMMAND_CLASS)
  const grouped = new Map<string, ValueId[]>()

  for (const value of values) {
    const key = String(value.property)
    const group = grouped.get(key)
    if (group) group.push(value)
    else grouped.set(key, [value])
  }

  return [...grouped.entries()]
    .map(([property, group]) => {
      const sorted = group.sort(compareValueIds)
      const primary = sorted.find((value) => value.propertyKey == null) ?? sorted[0]
      const partials = sorted.filter((value) => value.propertyKey != null)
      const writeableValues = sorted.filter((value) => value.writeable)
      return {
        id: `${primary.nodeId}:${primary.commandClass}:${String(primary.property)}`,
        property: primary.property,
        propertyKey: primary.propertyKey,
        number: property,
        label: primary.label || primary.propertyName || `Parameter ${property}`,
        description: primary.description,
        valueId: primary,
        partials,
        values: sorted,
        readable: sorted.some((value) => value.readable),
        writeable: writeableValues.length > 0,
        modified: sorted.some(isModified),
        advanced: sorted.some((value) => value.genre === 'system' || !value.writeable),
      } satisfies ConfigParam
    })
    .sort((a, b) => compareProperty(a.property, b.property))
}

export function editorKind(valueId: ValueId): ConfigEditorKind {
  if (valueId.propertyKey != null && valueId.type === 'boolean') return 'bitmask'
  if (valueId.states?.length) return 'enum'
  if (valueId.type === 'boolean') return 'bool'
  return 'number'
}

export function isModified(valueId: ValueId): boolean {
  if (valueId.default === undefined) return false
  return !sameValue(valueId.value, valueId.default)
}

export function coerceParamValue(valueId: ValueId, raw: unknown): unknown {
  const state = valueId.states?.find((item) => String(item.value) === String(raw))
  if (state) return state.value

  if (valueId.type === 'boolean') return coerceBoolean(raw)

  if (valueId.type === 'number' || valueId.type === 'duration' || typeof valueId.default === 'number') {
    const num = Number(raw)
    if (!Number.isFinite(num)) return valueId.value ?? valueId.default ?? 0
    const min = typeof valueId.min === 'number' ? valueId.min : -Infinity
    const max = typeof valueId.max === 'number' ? valueId.max : Infinity
    return Math.min(max, Math.max(min, num))
  }

  return raw
}

export function paramSearchText(param: ConfigParam): string {
  return [
    param.number,
    param.label,
    param.description ?? '',
    ...param.values.flatMap((value) => [value.propertyName ?? '', value.propertyKeyName ?? '', value.label ?? '']),
  ]
    .join(' ')
    .toLowerCase()
}

function compareValueIds(a: ValueId, b: ValueId): number {
  return compareProperty(a.propertyKey ?? '', b.propertyKey ?? '') || a.id.localeCompare(b.id)
}

function compareProperty(a: ValueId['property'], b: ValueId['property']): number {
  const an = Number(a)
  const bn = Number(b)
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

function coerceBoolean(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  const value = String(raw).trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'on' || value === 'yes' || value === 'enabled'
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b)
  return false
}

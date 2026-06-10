import { describe, expect, it, vi } from 'vitest'
import type { ValueId, ZwaveNode } from '@/api'
import {
  CONFIGURATION_COMMAND_CLASS,
  coerceParamValue,
  configParams,
  editorKind,
  getDeviceConfigurationParams,
  isModified,
} from '../configuration'

vi.mock('@/api', () => ({
  zwaveSocket: {
    callApi: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  },
}))

function value(p: Partial<ValueId> & { property: number | string }): ValueId {
  return {
    id: `2-112-0-${p.property}${p.propertyKey != null ? `-${p.propertyKey}` : ''}`,
    nodeId: 2,
    commandClass: CONFIGURATION_COMMAND_CLASS,
    endpoint: 0,
    type: 'number',
    readable: true,
    writeable: true,
    ...p,
  } as ValueId
}

function node(values: ValueId[]): ZwaveNode {
  return {
    id: 2,
    ready: true,
    available: true,
    failed: false,
    inited: true,
    values: Object.fromEntries(values.map((item) => [item.id, item])),
  }
}

describe('configuration parameter helpers', () => {
  it('selects editors from metadata', () => {
    expect(editorKind(value({ property: 1, states: [{ text: 'Low', value: 0 }] }))).toBe('enum')
    expect(editorKind(value({ property: 2, type: 'number', min: 0, max: 99 }))).toBe('number')
    expect(editorKind(value({ property: 3, type: 'boolean' }))).toBe('bool')
    expect(editorKind(value({ property: 4, propertyKey: 1, type: 'boolean' }))).toBe('bitmask')
  })

  it('detects values that differ from defaults', () => {
    expect(isModified(value({ property: 1, value: 5, default: 5 }))).toBe(false)
    expect(isModified(value({ property: 1, value: 7, default: 5 }))).toBe(true)
    expect(isModified(value({ property: 1, value: 7 }))).toBe(false)
  })

  it('coerces enum, numeric, clamped numeric, and boolean inputs', () => {
    const enumParam = value({ property: 1, states: [{ text: 'Low', value: 0 }, { text: 'High', value: 2 }] })
    expect(coerceParamValue(enumParam, '2')).toBe(2)

    const numeric = value({ property: 2, min: 1, max: 10, value: 5, default: 3 })
    expect(coerceParamValue(numeric, '8')).toBe(8)
    expect(coerceParamValue(numeric, '20')).toBe(10)
    expect(coerceParamValue(numeric, 'nope')).toBe(5)

    expect(coerceParamValue(value({ property: 3, type: 'boolean' }), 'true')).toBe(true)
    expect(coerceParamValue(value({ property: 3, type: 'boolean' }), 0)).toBe(false)
  })

  it('extracts and groups Configuration CC values, including bitmask partials', () => {
    const params = configParams(node([
      value({ property: 10, label: 'LED mode', value: 1, default: 0 }),
      value({ property: 11, propertyKey: 1, type: 'boolean', label: 'Invert', value: true, default: false }),
      value({ property: 11, propertyKey: 2, type: 'boolean', label: 'Night mode', value: false, default: false }),
      value({ property: 12, label: 'System flag', genre: 'system', writeable: false, value: 1, default: 1 }),
      { ...value({ property: 'currentValue' }), commandClass: 37 },
    ]))

    expect(params.map((param) => param.number)).toEqual(['10', '11', '12'])
    expect(params[0]).toMatchObject({ label: 'LED mode', modified: true, writeable: true })
    expect(params[1].partials).toHaveLength(2)
    expect(params[1].modified).toBe(true)
    expect(params[2]).toMatchObject({ advanced: true, writeable: false })
  })

  it('wraps getDeviceConfigurationParams API', async () => {
    const { zwaveSocket } = await import('@/api')
    await getDeviceConfigurationParams(2)
    expect(zwaveSocket.callApi).toHaveBeenCalledWith('getDeviceConfigurationParams', 2)
  })
})

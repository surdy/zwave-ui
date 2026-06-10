import { describe, expect, it, vi, beforeEach } from 'vitest'
import { zwaveSocket } from '@/api/socket'
import {
  applyConfirmationMatches,
  applyConfigurationTemplate,
  applyPreviewTargets,
  createConfigurationTemplate,
  deleteConfigurationTemplate,
  getConfigurationTemplates,
  importConfigurationTemplates,
  isCompatibleNode,
  parseTemplatesJson,
  templatesToJson,
  updateConfigurationTemplate,
  type ZUIConfigurationTemplate,
} from '@/automation/configTemplates'
import type { ZwaveNode } from '@/api/types'

vi.mock('@/api/socket', () => ({
  zwaveSocket: { callApi: vi.fn() },
}))

const mockedCallApi = vi.mocked(zwaveSocket.callApi)

const template: ZUIConfigurationTemplate = {
  id: 'tpl-1',
  name: 'Dimmer defaults',
  deviceId: '1-3-2',
  manufacturerId: 1,
  productType: 3,
  productId: 2,
  values: [{ property: 1, propertyKey: null, endpoint: 0, value: 99 }],
  autoApply: false,
}

const matchingNode = {
  id: 7,
  manufacturerId: 1,
  productType: 3,
  productId: 2,
  deviceId: '1-3-2',
} as ZwaveNode

const mismatchedNode = {
  id: 8,
  manufacturerId: 1,
  productType: 4,
  productId: 2,
  deviceId: '1-4-2',
} as ZwaveNode

describe('configuration template API wrappers', () => {
  beforeEach(() => mockedCallApi.mockReset())

  it('calls getConfigurationTemplates with the expected method', () => {
    void getConfigurationTemplates()
    expect(mockedCallApi).toHaveBeenCalledWith('getConfigurationTemplates')
  })

  it('calls createConfigurationTemplate with upstream argument order', () => {
    const values = [{ property: 2, endpoint: 0, value: true }]
    void createConfigurationTemplate(3, 'Template', true, values)
    expect(mockedCallApi).toHaveBeenCalledWith('createConfigurationTemplate', 3, 'Template', true, values)
  })

  it('calls update, delete, apply, and import wrappers with correct args', () => {
    void updateConfigurationTemplate('tpl-1', { name: 'Updated' })
    void deleteConfigurationTemplate('tpl-1')
    void applyConfigurationTemplate('tpl-1', 9, true)
    void importConfigurationTemplates([template])

    expect(mockedCallApi).toHaveBeenCalledWith('updateConfigurationTemplate', 'tpl-1', { name: 'Updated' })
    expect(mockedCallApi).toHaveBeenCalledWith('deleteConfigurationTemplate', 'tpl-1')
    expect(mockedCallApi).toHaveBeenCalledWith('applyConfigurationTemplate', 'tpl-1', 9, true)
    expect(mockedCallApi).toHaveBeenCalledWith('importConfigurationTemplates', [template])
  })
})

describe('configuration template compatibility', () => {
  it('matches a node with the same manufacturer/product/type', () => {
    expect(isCompatibleNode(template, matchingNode)).toBe(true)
  })

  it('rejects a mismatched node unless force is enabled', () => {
    expect(isCompatibleNode(template, mismatchedNode)).toBe(false)
    expect(isCompatibleNode(template, mismatchedNode, true)).toBe(true)
  })

  it('builds an apply preview from compatible targets', () => {
    expect(applyPreviewTargets(template, [matchingNode, mismatchedNode])).toEqual([matchingNode])
    expect(applyPreviewTargets(template, [matchingNode, mismatchedNode], true)).toEqual([matchingNode, mismatchedNode])
  })
})

describe('configuration template JSON helpers', () => {
  it('serializes and parses valid template arrays', () => {
    expect(parseTemplatesJson(templatesToJson([template]))).toEqual([template])
  })

  it('rejects malformed JSON and invalid template shapes', () => {
    expect(() => parseTemplatesJson('{')).toThrow('valid JSON')
    expect(() => parseTemplatesJson(JSON.stringify([{ id: 'x', values: [] }]))).toThrow('invalid name')
  })
})

describe('configuration template apply confirmation guard', () => {
  it('only accepts the exact APPLY token after trimming', () => {
    expect(applyConfirmationMatches('APPLY')).toBe(true)
    expect(applyConfirmationMatches(' APPLY ')).toBe(true)
    expect(applyConfirmationMatches('apply')).toBe(false)
    expect(applyConfirmationMatches('DELETE')).toBe(false)
  })
})

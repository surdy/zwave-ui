import { zwaveSocket } from '@/api/socket'
import type { CallApiResult, ZwaveNode } from '@/api/types'

export interface ZUIConfigurationTemplateValue {
  property: number
  propertyKey?: number | null
  endpoint: number
  value: unknown
  label?: string
  description?: string
}

export interface ZUIConfigurationTemplate {
  id: string
  name: string
  description?: string
  deviceId?: string
  manufacturerId?: number
  productId?: number
  productType?: number
  manufacturer?: string
  productLabel?: string
  firmwareRange?: { min?: string; max?: string }
  values: ZUIConfigurationTemplateValue[]
  autoApply: boolean
  contentHash?: string
  createdAt?: string
  updatedAt?: string
}

export interface ApplyConfigurationTemplateResult {
  success: number
  failed: number
  errors: string[]
  reason?: string
}

export type ConfigurationTemplatePatch = Partial<Pick<ZUIConfigurationTemplate, 'name' | 'description' | 'values' | 'autoApply' | 'firmwareRange'>>

export function getConfigurationTemplates(): Promise<CallApiResult<ZUIConfigurationTemplate[]>> {
  return zwaveSocket.callApi<ZUIConfigurationTemplate[]>('getConfigurationTemplates')
}

export function createConfigurationTemplate(
  nodeId: number,
  name: string,
  autoApply = false,
  values?: ZUIConfigurationTemplateValue[],
): Promise<CallApiResult<ZUIConfigurationTemplate>> {
  return zwaveSocket.callApi<ZUIConfigurationTemplate>('createConfigurationTemplate', nodeId, name, autoApply, values)
}

export function updateConfigurationTemplate(
  id: string,
  patch: ConfigurationTemplatePatch,
): Promise<CallApiResult<ZUIConfigurationTemplate>> {
  return zwaveSocket.callApi<ZUIConfigurationTemplate>('updateConfigurationTemplate', id, patch)
}

export function deleteConfigurationTemplate(id: string): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi<boolean>('deleteConfigurationTemplate', id)
}

export function applyConfigurationTemplate(
  templateId: string,
  nodeId: number,
  force = false,
): Promise<CallApiResult<ApplyConfigurationTemplateResult>> {
  return zwaveSocket.callApi<ApplyConfigurationTemplateResult>('applyConfigurationTemplate', templateId, nodeId, force)
}

export function importConfigurationTemplates(
  templates: ZUIConfigurationTemplate[],
): Promise<CallApiResult<ZUIConfigurationTemplate[]>> {
  return zwaveSocket.callApi<ZUIConfigurationTemplate[]>('importConfigurationTemplates', templates)
}

export function templateValueCount(template: Pick<ZUIConfigurationTemplate, 'values'>): number {
  return template.values?.length ?? 0
}

export function templateDeviceLabel(template: Pick<ZUIConfigurationTemplate, 'manufacturer' | 'productLabel' | 'manufacturerId' | 'productId' | 'productType' | 'deviceId'>): string {
  const name = [template.manufacturer, template.productLabel].filter(Boolean).join(' · ')
  if (name) return name
  const ids = [template.manufacturerId, template.productType, template.productId]
    .filter((value) => value !== undefined && value !== null)
    .join('-')
  return ids || template.deviceId || 'Unknown device scope'
}

export function isCompatibleNode(
  template: Pick<ZUIConfigurationTemplate, 'manufacturerId' | 'productId' | 'productType' | 'deviceId'>,
  node: Pick<ZwaveNode, 'manufacturerId' | 'productId' | 'productType' | 'deviceId'>,
  force = false,
): boolean {
  if (force) return true

  const scopedIds = [template.manufacturerId, template.productId, template.productType]
  const hasNumericScope = scopedIds.some((value) => value !== undefined && value !== null)
  if (hasNumericScope) {
    return template.manufacturerId === node.manufacturerId
      && template.productId === node.productId
      && template.productType === node.productType
  }

  return Boolean(template.deviceId && node.deviceId && template.deviceId === node.deviceId)
}

export function applyPreviewTargets(
  template: Pick<ZUIConfigurationTemplate, 'manufacturerId' | 'productId' | 'productType' | 'deviceId'>,
  nodes: Pick<ZwaveNode, 'manufacturerId' | 'productId' | 'productType' | 'deviceId'>[],
  force = false,
): Pick<ZwaveNode, 'manufacturerId' | 'productId' | 'productType' | 'deviceId'>[] {
  return nodes.filter((node) => isCompatibleNode(template, node, force))
}

export function templatesToJson(templates: ZUIConfigurationTemplate[]): string {
  return JSON.stringify(templates, null, 2)
}

export function parseTemplatesJson(text: string): ZUIConfigurationTemplate[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Template import must be valid JSON.')
  }

  if (!Array.isArray(parsed)) throw new Error('Template import must be a JSON array.')
  parsed.forEach(assertTemplate)
  return parsed
}

export function applyConfirmationMatches(typed: string): boolean {
  return typed.trim() === 'APPLY'
}

export function isValidTemplateName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 0 && trimmed.length <= 80
}

function assertTemplate(value: unknown, index: number): asserts value is ZUIConfigurationTemplate {
  if (!isRecord(value)) throw new Error(`Template ${index + 1} must be an object.`)
  if (typeof value.id !== 'string' || value.id.trim().length === 0) throw new Error(`Template ${index + 1} is missing an id.`)
  if (typeof value.name !== 'string' || !isValidTemplateName(value.name)) throw new Error(`Template ${index + 1} has an invalid name.`)
  if (!Array.isArray(value.values)) throw new Error(`Template ${index + 1} must include a values array.`)
  if (typeof value.autoApply !== 'boolean') throw new Error(`Template ${index + 1} must include autoApply.`)
  value.values.forEach((item, itemIndex) => assertTemplateValue(item, index, itemIndex))
}

function assertTemplateValue(value: unknown, templateIndex: number, valueIndex: number): asserts value is ZUIConfigurationTemplateValue {
  if (!isRecord(value)) throw new Error(`Template ${templateIndex + 1} value ${valueIndex + 1} must be an object.`)
  if (!Number.isInteger(value.property)) throw new Error(`Template ${templateIndex + 1} value ${valueIndex + 1} has an invalid property.`)
  if (value.propertyKey !== undefined && value.propertyKey !== null && !Number.isInteger(value.propertyKey)) throw new Error(`Template ${templateIndex + 1} value ${valueIndex + 1} has an invalid propertyKey.`)
  if (!Number.isInteger(value.endpoint)) throw new Error(`Template ${templateIndex + 1} value ${valueIndex + 1} has an invalid endpoint.`)
  if (!('value' in value)) throw new Error(`Template ${templateIndex + 1} value ${valueIndex + 1} is missing a value.`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

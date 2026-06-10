import { zwaveSocket, type CallApiResult } from '@/api'

export const SecurityClass = {
  S2Unauthenticated: 0,
  S2Authenticated: 1,
  S2AccessControl: 2,
  S0Legacy: 7,
} as const

export type SecurityClassValue = (typeof SecurityClass)[keyof typeof SecurityClass]

export const ProvisioningEntryStatus = {
  Active: 0,
  Inactive: 1,
} as const

export type ProvisioningEntryStatusValue = (typeof ProvisioningEntryStatus)[keyof typeof ProvisioningEntryStatus]

export interface ParsedQrResponse {
  parsed?: unknown
  nodeId?: number
  exists?: boolean
}

export interface NormalizedSmartStartQr {
  dsk: string
  nodeId?: number
  exists: boolean
  manufacturerId?: number
  productType?: number
  productId?: number
  applicationVersion?: string
  genericDeviceClass?: number
  specificDeviceClass?: number
  installerIconType?: number
  maxInclusionRequestInterval?: number
  uuid?: string
  supportedProtocols?: number[]
  securityClasses: SecurityClassValue[]
  requestedSecurityClasses: SecurityClassValue[]
}

export interface PlannedProvisioningEntry {
  dsk: string
  status?: ProvisioningEntryStatusValue
  protocol?: number
  supportedProtocols?: number[]
  securityClasses: SecurityClassValue[]
  requestedSecurityClasses?: SecurityClassValue[]
  name?: string
  location?: string
  nodeId?: number
  manufacturerId?: number
  productType?: number
  productId?: number
  applicationVersion?: string
  genericDeviceClass?: number
  specificDeviceClass?: number
  installerIconType?: number
  maxInclusionRequestInterval?: number
  uuid?: string
  manufacturer?: string
  label?: string
  description?: string
  [extra: string]: unknown
}

export type SmartStartProvisioningEntry = PlannedProvisioningEntry & {
  nodeId?: number
}

export interface ProvisioningOptions {
  name?: string
  location?: string
  securityClasses?: SecurityClassValue[]
}

export function parseQRCodeString(qr: string): Promise<CallApiResult<ParsedQrResponse>> {
  return zwaveSocket.callApi('parseQRCodeString', qr)
}

export function provisionSmartStartNode(entry: PlannedProvisioningEntry | string): Promise<CallApiResult<PlannedProvisioningEntry>> {
  return zwaveSocket.callApi('provisionSmartStartNode', entry)
}

export function unprovisionSmartStartNode(dskOrNodeId: string | number): Promise<CallApiResult<void>> {
  return zwaveSocket.callApi('unprovisionSmartStartNode', dskOrNodeId)
}

export function getProvisioningEntries(): Promise<CallApiResult<SmartStartProvisioningEntry[]>> {
  return zwaveSocket.callApi('getProvisioningEntries')
}

export function getProvisioningEntry(dsk: string): Promise<CallApiResult<SmartStartProvisioningEntry | undefined>> {
  return zwaveSocket.callApi('getProvisioningEntry', dsk)
}

export function normalizeParsedQr(result: unknown): NormalizedSmartStartQr {
  const response = asRecord(result)
  const source = asRecord(response.parsed ?? result)
  const dsk = String(source.dsk ?? '')
  if (!dsk) throw new Error('Parsed QR code did not include a DSK')

  return {
    dsk,
    nodeId: toOptionalNumber(response.nodeId ?? source.nodeId),
    exists: Boolean(response.exists ?? source.exists),
    manufacturerId: toOptionalNumber(source.manufacturerId),
    productType: toOptionalNumber(source.productType),
    productId: toOptionalNumber(source.productId),
    applicationVersion: toOptionalString(source.applicationVersion),
    genericDeviceClass: toOptionalNumber(source.genericDeviceClass),
    specificDeviceClass: toOptionalNumber(source.specificDeviceClass),
    installerIconType: toOptionalNumber(source.installerIconType),
    maxInclusionRequestInterval: toOptionalNumber(source.maxInclusionRequestInterval),
    uuid: toOptionalString(source.uuid),
    supportedProtocols: toNumberArray(source.supportedProtocols),
    securityClasses: toSecurityClassArray(source.securityClasses),
    requestedSecurityClasses: toSecurityClassArray(source.requestedSecurityClasses),
  }
}

export function buildProvisioningEntry(parsed: NormalizedSmartStartQr, options: ProvisioningOptions = {}): PlannedProvisioningEntry {
  const entry: PlannedProvisioningEntry = {
    dsk: parsed.dsk,
    securityClasses: options.securityClasses ?? parsed.securityClasses,
  }

  copyDefined(entry, parsed, [
    'manufacturerId',
    'productType',
    'productId',
    'applicationVersion',
    'genericDeviceClass',
    'specificDeviceClass',
    'installerIconType',
    'maxInclusionRequestInterval',
    'uuid',
  ])

  if (parsed.supportedProtocols?.length) entry.supportedProtocols = parsed.supportedProtocols
  if (parsed.requestedSecurityClasses.length) entry.requestedSecurityClasses = parsed.requestedSecurityClasses
  if (options.name?.trim()) entry.name = options.name.trim()
  if (options.location?.trim()) entry.location = options.location.trim()

  return entry
}

export function provisioningStatusLabel(entry: SmartStartProvisioningEntry): string {
  if (typeof entry.nodeId === 'number') return `Included · Node ${entry.nodeId}`
  if (entry.status === ProvisioningEntryStatus.Inactive) return 'Inactive'
  return 'Pending'
}

export function isBarcodeDetectorSupported(target: { BarcodeDetector?: unknown } | undefined): boolean {
  return typeof target?.BarcodeDetector === 'function'
}

function copyDefined<T extends object, K extends keyof NormalizedSmartStartQr>(target: T, source: NormalizedSmartStartQr, keys: K[]) {
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined) Object.assign(target, { [key]: value })
  }
}

function toOptionalNumber(value: unknown): number | undefined {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function toNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.map(Number).filter(Number.isFinite)
}

function toSecurityClassArray(value: unknown): SecurityClassValue[] {
  return (toNumberArray(value) ?? []).filter(isSecurityClass)
}

function isSecurityClass(value: number): value is SecurityClassValue {
  return Object.values(SecurityClass).includes(value as SecurityClassValue)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

import { getJson, type RequestOptions } from '@/api/rest'
import {
  getSettings,
  updateSettings,
  type SettingsPatch,
  type SettingsResponse,
} from '@/settings/settingsApi'

export const RF_REGIONS = [
  { label: 'Europe', value: 0 },
  { label: 'USA', value: 1 },
  { label: 'Australia/New Zealand', value: 2 },
  { label: 'Hong Kong', value: 3 },
  { label: 'India', value: 5 },
  { label: 'Israel', value: 6 },
  { label: 'Russia', value: 7 },
  { label: 'China', value: 8 },
  { label: 'USA (Long Range)', value: 9 },
  { label: 'Europe (Long Range)', value: 11 },
  { label: 'Japan', value: 32 },
  { label: 'Korea', value: 33 },
  { label: 'Unknown', value: 254, disabled: true },
  { label: 'Default (EU)', value: 255, disabled: true },
] as const

export const LOG_LEVELS = [
  { label: 'Error', value: 'error' },
  { label: 'Warn', value: 'warn' },
  { label: 'Info', value: 'info' },
  { label: 'Verbose', value: 'verbose' },
  { label: 'Debug', value: 'debug' },
  { label: 'Silly', value: 'silly' },
] as const

export type RFRegionValue = (typeof RF_REGIONS)[number]['value']
export type LogLevel = (typeof LOG_LEVELS)[number]['value']

export const securityKeyFields = [
  { key: 'S0_Legacy', label: 'S0 Legacy' },
  { key: 'S2_Unauthenticated', label: 'S2 Unauthenticated' },
  { key: 'S2_Authenticated', label: 'S2 Authenticated' },
  { key: 'S2_AccessControl', label: 'S2 Access Control' },
] as const

export const longRangeSecurityKeyFields = [
  { key: 'S2_Authenticated', label: 'Long Range S2 Authenticated' },
  { key: 'S2_AccessControl', label: 'Long Range S2 Access Control' },
] as const

export type SecurityKeyName = (typeof securityKeyFields)[number]['key']
export type LongRangeSecurityKeyName = (typeof longRangeSecurityKeyFields)[number]['key']
export type SecurityKeys = Record<SecurityKeyName, string>
export type LongRangeSecurityKeys = Record<LongRangeSecurityKeyName, string>

export interface ZwaveSettingsForm {
  enabled: boolean
  port: string
  rfRegion: RFRegionValue
  logLevel: LogLevel
  enableSoftReset: boolean
  serverEnabled: boolean
  serverPort: number | null
  commandsTimeout: number | null
  securityKeys: SecurityKeys
  securityKeysLongRange: LongRangeSecurityKeys
}

export interface SerialPort {
  path: string
  manufacturer?: string
  serialNumber?: string
  pnpId?: string
  friendlyName?: string
  [key: string]: unknown
}

export interface SerialPortsResponse {
  success?: boolean
  serial_ports?: SerialPort[]
  serialPorts?: SerialPort[]
}

export interface ZwaveFieldErrors {
  port?: string
  serverPort?: string
  commandsTimeout?: string
  securityKeys?: Partial<Record<SecurityKeyName, string>>
  securityKeysLongRange?: Partial<Record<LongRangeSecurityKeyName, string>>
}

const DEFAULT_FORM: ZwaveSettingsForm = {
  enabled: true,
  port: '',
  rfRegion: 0,
  logLevel: 'info',
  enableSoftReset: true,
  serverEnabled: false,
  serverPort: 3000,
  commandsTimeout: 30,
  securityKeys: {
    S0_Legacy: '',
    S2_Unauthenticated: '',
    S2_Authenticated: '',
    S2_AccessControl: '',
  },
  securityKeysLongRange: {
    S2_Authenticated: '',
    S2_AccessControl: '',
  },
}

const HEX_KEY_RE = /^[0-9a-f]{32}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function numberValue(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function logLevelValue(value: unknown): LogLevel {
  return LOG_LEVELS.some((level) => level.value === value) ? (value as LogLevel) : DEFAULT_FORM.logLevel
}

function rfRegionValue(value: unknown): RFRegionValue {
  return RF_REGIONS.some((region) => region.value === value)
    ? (value as RFRegionValue)
    : DEFAULT_FORM.rfRegion
}

function settingsRoot(response: SettingsResponse): Record<string, unknown> {
  return isRecord(response.settings) ? response.settings : response
}

function readKeyMap<T extends readonly { key: string }[]>(
  source: unknown,
  fields: T,
): Record<T[number]['key'], string> {
  const record = isRecord(source) ? source : {}
  return Object.fromEntries(fields.map((field) => [field.key, stringValue(record[field.key])])) as Record<
    T[number]['key'],
    string
  >
}

export function isValidHexKey(value: string): boolean {
  return HEX_KEY_RE.test(value.trim())
}

export function isValidPort(value: number | string | null | undefined): boolean {
  const port = typeof value === 'string' ? Number(value) : value
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535
}

export function isRemoteUrl(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.startsWith('tcp://') || trimmed.startsWith('ws://') || trimmed.startsWith('wss://')
}

export function isValidRemoteUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!isRemoteUrl(trimmed)) return false

  try {
    const url = new URL(trimmed)
    if (!url.hostname) return false
    if (url.protocol === 'tcp:') return isValidPort(url.port)
    return (url.protocol === 'ws:' || url.protocol === 'wss:') && (!url.port || isValidPort(url.port))
  } catch {
    return false
  }
}

export function validateZwaveForm(form: ZwaveSettingsForm): ZwaveFieldErrors {
  const errors: ZwaveFieldErrors = {}

  if (form.enabled && !form.port.trim()) {
    errors.port = 'Choose a serial port or enter a remote controller URL.'
  } else if (form.port.trim() && isRemoteUrl(form.port) && !isValidRemoteUrl(form.port)) {
    errors.port = 'Use tcp://host:port, ws://host:port, or wss://host:port.'
  }

  if (form.serverEnabled && !isValidPort(form.serverPort)) {
    errors.serverPort = 'Use a server port between 1 and 65535.'
  }

  if (
    form.commandsTimeout !== null &&
    (!Number.isInteger(form.commandsTimeout) || form.commandsTimeout < 1 || form.commandsTimeout > 3600)
  ) {
    errors.commandsTimeout = 'Use a timeout between 1 and 3600 seconds.'
  }

  for (const field of securityKeyFields) {
    const value = form.securityKeys[field.key].trim()
    if (value && !isValidHexKey(value)) {
      errors.securityKeys = { ...errors.securityKeys, [field.key]: 'Use exactly 32 hexadecimal characters.' }
    }
  }

  for (const field of longRangeSecurityKeyFields) {
    const value = form.securityKeysLongRange[field.key].trim()
    if (value && !isValidHexKey(value)) {
      errors.securityKeysLongRange = {
        ...errors.securityKeysLongRange,
        [field.key]: 'Use exactly 32 hexadecimal characters.',
      }
    }
  }

  return errors
}

export function hasZwaveErrors(errors: ZwaveFieldErrors): boolean {
  return Boolean(
    errors.port ||
      errors.serverPort ||
      errors.commandsTimeout ||
      Object.keys(errors.securityKeys ?? {}).length ||
      Object.keys(errors.securityKeysLongRange ?? {}).length,
  )
}

export function generateSecurityKey(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function fromSettings(response: SettingsResponse): ZwaveSettingsForm {
  const root = settingsRoot(response)
  const zwave = isRecord(root.zwave) ? root.zwave : {}
  const rf = isRecord(zwave.rf) ? zwave.rf : {}

  return {
    enabled: booleanValue(zwave.enabled, DEFAULT_FORM.enabled),
    port: stringValue(zwave.port),
    rfRegion: rfRegionValue(rf.region),
    logLevel: logLevelValue(zwave.logLevel),
    enableSoftReset: booleanValue(zwave.enableSoftReset, DEFAULT_FORM.enableSoftReset),
    serverEnabled: booleanValue(zwave.serverEnabled, DEFAULT_FORM.serverEnabled),
    serverPort: numberValue(zwave.serverPort, DEFAULT_FORM.serverPort),
    commandsTimeout: numberValue(zwave.commandsTimeout, DEFAULT_FORM.commandsTimeout),
    securityKeys: readKeyMap(zwave.securityKeys, securityKeyFields),
    securityKeysLongRange: readKeyMap(zwave.securityKeysLongRange, longRangeSecurityKeyFields),
  }
}

export function toSettingsPatch(form: ZwaveSettingsForm): SettingsPatch {
  return {
    zwave: {
      enabled: form.enabled,
      port: form.port.trim(),
      rf: { region: form.rfRegion },
      logLevel: form.logLevel,
      enableSoftReset: form.enableSoftReset,
      serverEnabled: form.serverEnabled,
      serverPort: form.serverPort,
      commandsTimeout: form.commandsTimeout,
      securityKeys: Object.fromEntries(
        securityKeyFields.map((field) => [field.key, form.securityKeys[field.key].trim()]),
      ),
      securityKeysLongRange: Object.fromEntries(
        longRangeSecurityKeyFields.map((field) => [field.key, form.securityKeysLongRange[field.key].trim()]),
      ),
    },
  }
}

export async function loadZwaveSettings(opts: RequestOptions = {}): Promise<ZwaveSettingsForm> {
  return fromSettings(await getSettings(opts))
}

export function saveZwaveSettings(form: ZwaveSettingsForm, opts: RequestOptions = {}): Promise<SettingsResponse> {
  return updateSettings(toSettingsPatch(form), opts)
}

export async function scanSerialPorts(opts: RequestOptions = {}): Promise<SerialPort[]> {
  const response = await getJson<SerialPortsResponse | SerialPort[]>('/api/serial-ports', opts)
  if (Array.isArray(response)) return response
  return response.serial_ports ?? response.serialPorts ?? []
}

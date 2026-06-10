import { zwaveSocket } from '@/api/socket'
import { getJson } from '@/api/rest'
import { getSettings, updateSettings, type SettingsPatch, type SettingsResponse, type ZwaveUiSettings } from './settingsApi'

export const LOG_LEVELS = [
  { label: 'Error', value: 'error' },
  { label: 'Warn', value: 'warn' },
  { label: 'Info', value: 'info' },
  { label: 'Verbose', value: 'verbose' },
  { label: 'Debug', value: 'debug' },
  { label: 'Silly', value: 'silly' },
] as const

export type LogLevel = (typeof LOG_LEVELS)[number]['value']

export interface VersionInfo {
  appVersion: string
  zwavejs: string
  zwavejsServer: string
}

export interface HealthEndpoint {
  status: number
  text?: string
}

export interface HealthStatus {
  overall: boolean
  zwave: boolean
  mqtt: boolean
  details: {
    overall: string
    zwave: string
    mqtt: string
  }
}

export interface SystemSettingsForm {
  authEnabled: boolean
  gatewayLogEnabled: boolean
  gatewayLogLevel: LogLevel
  gatewayLogToFile: boolean
  zwaveLogEnabled: boolean
  zwaveLogLevel: LogLevel
  zwaveLogToFile: boolean
  gatewayExtra: Record<string, unknown>
  zwaveExtra: Record<string, unknown>
}

export interface ChangePasswordResult {
  success: boolean
  message?: string
}

export interface ConfigUpdateResult {
  success: boolean
  result?: string | boolean
  message?: string
}

const DEFAULT_VERSION: VersionInfo = {
  appVersion: 'Unknown',
  zwavejs: 'Unknown',
  zwavejsServer: 'Unknown',
}

const DEFAULT_FORM: SystemSettingsForm = {
  authEnabled: false,
  gatewayLogEnabled: false,
  gatewayLogLevel: 'info',
  gatewayLogToFile: false,
  zwaveLogEnabled: false,
  zwaveLogLevel: 'info',
  zwaveLogToFile: false,
  gatewayExtra: {},
  zwaveExtra: {},
}

const GATEWAY_KEYS = new Set(['authEnabled', 'logEnabled', 'logLevel', 'logToFile'])
const ZWAVE_KEYS = new Set(['logEnabled', 'logLevel', 'logToFile'])
export const MIN_PASSWORD_LENGTH = 8

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function extras(source: Record<string, unknown>, known: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !known.has(key)))
}

function logLevelValue(value: unknown, fallback: LogLevel): LogLevel {
  return LOG_LEVELS.some((level) => level.value === value) ? (value as LogLevel) : fallback
}

function settingsFrom(response: SettingsResponse | ZwaveUiSettings): ZwaveUiSettings {
  return (response as SettingsResponse).settings ?? (response as ZwaveUiSettings)
}

function healthLabel(endpoint: HealthEndpoint): string {
  const text = endpoint.text?.trim()
  if (text) return text
  return endpoint.status >= 200 && endpoint.status < 300 ? 'Ok' : 'Error'
}

async function fetchHealthEndpoint(path: string): Promise<HealthEndpoint> {
  try {
    const res = await fetch(path, {
      method: 'GET',
      headers: { Accept: 'text/plain' },
      credentials: 'include',
    })
    return { status: res.status, text: await res.text() }
  } catch (err) {
    return { status: 0, text: err instanceof Error ? err.message : 'Network error' }
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : (undefined as T)
}

export function parseVersion(resp: unknown): VersionInfo {
  const record = asRecord(resp)
  return {
    appVersion: stringValue(record.appVersion, DEFAULT_VERSION.appVersion),
    zwavejs: stringValue(record.zwavejs, DEFAULT_VERSION.zwavejs),
    zwavejsServer: stringValue(record.zwavejsServer, DEFAULT_VERSION.zwavejsServer),
  }
}

export function parseHealth(overall: HealthEndpoint, zwave: HealthEndpoint, mqtt: HealthEndpoint): HealthStatus {
  return {
    overall: overall.status >= 200 && overall.status < 300,
    zwave: zwave.status >= 200 && zwave.status < 300,
    mqtt: mqtt.status >= 200 && mqtt.status < 300,
    details: {
      overall: healthLabel(overall),
      zwave: healthLabel(zwave),
      mqtt: healthLabel(mqtt),
    },
  }
}

export function fromSettings(response: SettingsResponse | ZwaveUiSettings): SystemSettingsForm {
  const settings = settingsFrom(response)
  const gateway = asRecord(settings.gateway)
  const zwave = asRecord(settings.zwave)

  return {
    ...DEFAULT_FORM,
    authEnabled: booleanValue(gateway.authEnabled, DEFAULT_FORM.authEnabled),
    gatewayLogEnabled: booleanValue(gateway.logEnabled, DEFAULT_FORM.gatewayLogEnabled),
    gatewayLogLevel: logLevelValue(gateway.logLevel, DEFAULT_FORM.gatewayLogLevel),
    gatewayLogToFile: booleanValue(gateway.logToFile, DEFAULT_FORM.gatewayLogToFile),
    zwaveLogEnabled: booleanValue(zwave.logEnabled, DEFAULT_FORM.zwaveLogEnabled),
    zwaveLogLevel: logLevelValue(zwave.logLevel, DEFAULT_FORM.zwaveLogLevel),
    zwaveLogToFile: booleanValue(zwave.logToFile, DEFAULT_FORM.zwaveLogToFile),
    gatewayExtra: extras(gateway, GATEWAY_KEYS),
    zwaveExtra: extras(zwave, ZWAVE_KEYS),
  }
}

export function toSettingsPatch(form: SystemSettingsForm): SettingsPatch {
  return {
    gateway: {
      ...form.gatewayExtra,
      authEnabled: form.authEnabled,
      logEnabled: form.gatewayLogEnabled,
      logLevel: form.gatewayLogLevel,
      logToFile: form.gatewayLogToFile,
    },
    zwave: {
      ...form.zwaveExtra,
      logEnabled: form.zwaveLogEnabled,
      logLevel: form.zwaveLogLevel,
      logToFile: form.zwaveLogToFile,
    },
  }
}

export function isValidNewPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return password === confirm
}

export async function fetchVersion(): Promise<VersionInfo> {
  return parseVersion(await getJson<unknown>('/version'))
}

export async function fetchHealth(): Promise<HealthStatus> {
  const [overall, zwave, mqtt] = await Promise.all([
    fetchHealthEndpoint('/health'),
    fetchHealthEndpoint('/health/zwave'),
    fetchHealthEndpoint('/health/mqtt'),
  ])
  return parseHealth(overall, zwave, mqtt)
}

export async function loadSystemSettings(): Promise<SystemSettingsForm> {
  return fromSettings(await getSettings())
}

export async function saveSystemSettings(form: SystemSettingsForm): Promise<SettingsResponse> {
  return updateSettings(toSettingsPatch(form))
}

export async function changePassword(current: string, password: string): Promise<ChangePasswordResult> {
  const res = await fetch('/api/password', {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ current, new: password, confirmNew: password }),
  })
  return parseJsonResponse<ChangePasswordResult>(res)
}

export function checkConfigUpdates(): Promise<ConfigUpdateResult> {
  return zwaveSocket.callApi<string | undefined>('checkForConfigUpdates') as Promise<ConfigUpdateResult>
}

export function installConfigUpdate(): Promise<ConfigUpdateResult> {
  return zwaveSocket.callApi<boolean | undefined>('installConfigUpdate') as Promise<ConfigUpdateResult>
}

export function restartApp(): Promise<ConfigUpdateResult> {
  return zwaveSocket.callApi<boolean | undefined>('restart') as Promise<ConfigUpdateResult>
}

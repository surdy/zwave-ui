import { InboundEvent } from '@/api/events'
import { zwaveSocket } from '@/api/socket'
import type { CallApiResult } from '@/api/types'
import type { SettingsPatch, SettingsResponse, ZwaveUiSettings } from './settingsApi'

export const GATEWAY_TYPE = {
  VALUEID: 0,
  NAMED: 1,
  MANUAL: 2,
} as const

export const PAYLOAD_TYPE = {
  JSON_TIME_VALUE: 0,
  VALUEID: 1,
  RAW: 2,
} as const

export type GatewayType = (typeof GATEWAY_TYPE)[keyof typeof GATEWAY_TYPE]
export type PayloadType = (typeof PAYLOAD_TYPE)[keyof typeof PAYLOAD_TYPE]
export type MqttQos = 0 | 1 | 2

export const gatewayTypeLabels = {
  [GATEWAY_TYPE.VALUEID]: 'Value ID topics',
  [GATEWAY_TYPE.NAMED]: 'Named topics',
  [GATEWAY_TYPE.MANUAL]: 'Manual topics',
} as const satisfies Record<GatewayType, string>

export const payloadTypeLabels = {
  [PAYLOAD_TYPE.JSON_TIME_VALUE]: 'JSON Time-Value',
  [PAYLOAD_TYPE.VALUEID]: 'Value ID',
  [PAYLOAD_TYPE.RAW]: 'Raw',
} as const satisfies Record<PayloadType, string>

export interface MqttForm {
  enabled: boolean
  name: string
  host: string
  port: number | null
  reconnectPeriod: number | null
  prefix: string
  qos: MqttQos
  retain: boolean
  clean: boolean
  store: boolean
  allowSelfsigned: boolean
  key: string
  cert: string
  ca: string
  auth: boolean
  username: string
  password: string
  extra: Record<string, unknown>
}

export interface GatewayForm {
  type: GatewayType
  payloadType: PayloadType
  nodeNames: boolean
  ignoreLoc: boolean
  sendEvents: boolean
  ignoreStatus: boolean
  includeNodeInfo: boolean
  publishNodeDetails: boolean
  retainedDiscovery: boolean
  entityTemplate: string
  hassDiscovery: boolean
  discoveryPrefix: string
  useLocationAsSuggestedArea: boolean
  manualDiscovery: boolean
  logEnabled: boolean
  logLevel: string
  logToFile: boolean
  extra: Record<string, unknown>
}

export interface IntegrationsForm {
  mqtt: MqttForm
  gateway: GatewayForm
}

export type HassApiName =
  | 'rediscoverNode'
  | 'disableDiscovery'
  | 'discover'
  | 'delete'
  | 'add'
  | 'update'

export interface HassActionPayload {
  apiName: HassApiName
  nodeId?: number
  device?: unknown
}

const MQTT_KEYS = new Set<keyof MqttForm | 'disabled'>([
  'enabled',
  'name',
  'host',
  'port',
  'disabled',
  'reconnectPeriod',
  'prefix',
  'qos',
  'retain',
  'clean',
  'store',
  'allowSelfsigned',
  'key',
  'cert',
  'ca',
  'auth',
  'username',
  'password',
  'extra',
])

const GATEWAY_KEYS = new Set<keyof GatewayForm>([
  'type',
  'payloadType',
  'nodeNames',
  'ignoreLoc',
  'sendEvents',
  'ignoreStatus',
  'includeNodeInfo',
  'publishNodeDetails',
  'retainedDiscovery',
  'entityTemplate',
  'hassDiscovery',
  'discoveryPrefix',
  'useLocationAsSuggestedArea',
  'manualDiscovery',
  'logEnabled',
  'logLevel',
  'logToFile',
  'extra',
])

const DEFAULT_MQTT: MqttForm = {
  enabled: false,
  name: 'zwavejs2mqtt',
  host: '',
  port: 1883,
  reconnectPeriod: 3000,
  prefix: 'zwave',
  qos: 1,
  retain: true,
  clean: true,
  store: false,
  allowSelfsigned: false,
  key: '',
  cert: '',
  ca: '',
  auth: false,
  username: '',
  password: '',
  extra: {},
}

const DEFAULT_GATEWAY: GatewayForm = {
  type: GATEWAY_TYPE.VALUEID,
  payloadType: PAYLOAD_TYPE.JSON_TIME_VALUE,
  nodeNames: true,
  ignoreLoc: false,
  sendEvents: false,
  ignoreStatus: false,
  includeNodeInfo: false,
  publishNodeDetails: false,
  retainedDiscovery: true,
  entityTemplate: '',
  hassDiscovery: false,
  discoveryPrefix: 'homeassistant',
  useLocationAsSuggestedArea: false,
  manualDiscovery: false,
  logEnabled: false,
  logLevel: 'info',
  logToFile: false,
  extra: {},
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function numberValue(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function mqttQosValue(value: unknown, fallback: MqttQos): MqttQos {
  return value === 0 || value === 1 || value === 2 ? value : fallback
}

function gatewayTypeValue(value: unknown, fallback: GatewayType): GatewayType {
  return value === GATEWAY_TYPE.VALUEID || value === GATEWAY_TYPE.NAMED || value === GATEWAY_TYPE.MANUAL
    ? value
    : fallback
}

function payloadTypeValue(value: unknown, fallback: PayloadType): PayloadType {
  return value === PAYLOAD_TYPE.JSON_TIME_VALUE || value === PAYLOAD_TYPE.VALUEID || value === PAYLOAD_TYPE.RAW
    ? value
    : fallback
}

function extras(source: Record<string, unknown>, known: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !known.has(key)))
}

function settingsFrom(response: SettingsResponse | ZwaveUiSettings): ZwaveUiSettings {
  const maybeSettings = (response as SettingsResponse).settings
  return maybeSettings ? maybeSettings : (response as ZwaveUiSettings)
}

export function fromSettings(response: SettingsResponse | ZwaveUiSettings): IntegrationsForm {
  const settings = settingsFrom(response)
  const mqtt = asRecord(settings.mqtt)
  const gateway = asRecord(settings.gateway)

  return {
    mqtt: {
      ...DEFAULT_MQTT,
      enabled: !booleanValue(mqtt.disabled, true),
      name: stringValue(mqtt.name, DEFAULT_MQTT.name),
      host: stringValue(mqtt.host, DEFAULT_MQTT.host),
      port: numberValue(mqtt.port, DEFAULT_MQTT.port),
      reconnectPeriod: numberValue(mqtt.reconnectPeriod, DEFAULT_MQTT.reconnectPeriod),
      prefix: stringValue(mqtt.prefix, DEFAULT_MQTT.prefix),
      qos: mqttQosValue(mqtt.qos, DEFAULT_MQTT.qos),
      retain: booleanValue(mqtt.retain, DEFAULT_MQTT.retain),
      clean: booleanValue(mqtt.clean, DEFAULT_MQTT.clean),
      store: booleanValue(mqtt.store, DEFAULT_MQTT.store),
      allowSelfsigned: booleanValue(mqtt.allowSelfsigned, DEFAULT_MQTT.allowSelfsigned),
      key: stringValue(mqtt.key, DEFAULT_MQTT.key),
      cert: stringValue(mqtt.cert, DEFAULT_MQTT.cert),
      ca: stringValue(mqtt.ca, DEFAULT_MQTT.ca),
      auth: booleanValue(mqtt.auth, DEFAULT_MQTT.auth),
      username: stringValue(mqtt.username, DEFAULT_MQTT.username),
      password: stringValue(mqtt.password, DEFAULT_MQTT.password),
      extra: extras(mqtt, MQTT_KEYS),
    },
    gateway: {
      ...DEFAULT_GATEWAY,
      type: gatewayTypeValue(gateway.type, DEFAULT_GATEWAY.type),
      payloadType: payloadTypeValue(gateway.payloadType, DEFAULT_GATEWAY.payloadType),
      nodeNames: booleanValue(gateway.nodeNames, DEFAULT_GATEWAY.nodeNames),
      ignoreLoc: booleanValue(gateway.ignoreLoc, DEFAULT_GATEWAY.ignoreLoc),
      sendEvents: booleanValue(gateway.sendEvents, DEFAULT_GATEWAY.sendEvents),
      ignoreStatus: booleanValue(gateway.ignoreStatus, DEFAULT_GATEWAY.ignoreStatus),
      includeNodeInfo: booleanValue(gateway.includeNodeInfo, DEFAULT_GATEWAY.includeNodeInfo),
      publishNodeDetails: booleanValue(gateway.publishNodeDetails, DEFAULT_GATEWAY.publishNodeDetails),
      retainedDiscovery: booleanValue(gateway.retainedDiscovery, DEFAULT_GATEWAY.retainedDiscovery),
      entityTemplate: stringValue(gateway.entityTemplate, DEFAULT_GATEWAY.entityTemplate),
      hassDiscovery: booleanValue(gateway.hassDiscovery, DEFAULT_GATEWAY.hassDiscovery),
      discoveryPrefix: stringValue(gateway.discoveryPrefix, DEFAULT_GATEWAY.discoveryPrefix),
      useLocationAsSuggestedArea: booleanValue(
        gateway.useLocationAsSuggestedArea,
        DEFAULT_GATEWAY.useLocationAsSuggestedArea,
      ),
      manualDiscovery: booleanValue(gateway.manualDiscovery, DEFAULT_GATEWAY.manualDiscovery),
      logEnabled: booleanValue(gateway.logEnabled, DEFAULT_GATEWAY.logEnabled),
      logLevel: stringValue(gateway.logLevel, DEFAULT_GATEWAY.logLevel),
      logToFile: booleanValue(gateway.logToFile, DEFAULT_GATEWAY.logToFile),
      extra: extras(gateway, GATEWAY_KEYS),
    },
  }
}

export function toSettingsPatch(form: IntegrationsForm): SettingsPatch {
  return {
    mqtt: {
      ...form.mqtt.extra,
      name: form.mqtt.name.trim(),
      host: form.mqtt.host.trim(),
      port: form.mqtt.port ?? DEFAULT_MQTT.port,
      disabled: !form.mqtt.enabled,
      reconnectPeriod: form.mqtt.reconnectPeriod ?? DEFAULT_MQTT.reconnectPeriod,
      prefix: form.mqtt.prefix.trim(),
      qos: form.mqtt.qos,
      retain: form.mqtt.retain,
      clean: form.mqtt.clean,
      store: form.mqtt.store,
      allowSelfsigned: form.mqtt.allowSelfsigned,
      key: form.mqtt.key.trim(),
      cert: form.mqtt.cert.trim(),
      ca: form.mqtt.ca.trim(),
      auth: form.mqtt.auth,
      username: form.mqtt.username,
      password: form.mqtt.password,
    },
    gateway: {
      ...form.gateway.extra,
      type: form.gateway.type,
      payloadType: form.gateway.payloadType,
      nodeNames: form.gateway.nodeNames,
      ignoreLoc: form.gateway.ignoreLoc,
      sendEvents: form.gateway.sendEvents,
      ignoreStatus: form.gateway.ignoreStatus,
      includeNodeInfo: form.gateway.includeNodeInfo,
      publishNodeDetails: form.gateway.publishNodeDetails,
      retainedDiscovery: form.gateway.retainedDiscovery,
      entityTemplate: form.gateway.entityTemplate.trim(),
      hassDiscovery: form.gateway.hassDiscovery,
      discoveryPrefix: form.gateway.discoveryPrefix.trim() || DEFAULT_GATEWAY.discoveryPrefix,
      useLocationAsSuggestedArea: form.gateway.useLocationAsSuggestedArea,
      manualDiscovery: form.gateway.manualDiscovery,
      logEnabled: form.gateway.logEnabled,
      logLevel: form.gateway.logLevel,
      logToFile: form.gateway.logToFile,
    },
  }
}

export function isValidHost(value: string): boolean {
  const host = value.trim()
  return host.length > 0 && host.length <= 253 && !/\s/.test(host)
}

export function isValidPort(value: number | null): boolean {
  return Number.isInteger(value) && value !== null && value >= 1 && value <= 65535
}

export function isValidPrefix(value: string): boolean {
  const prefix = value.trim()
  return prefix.length > 0 && !prefix.startsWith('/') && !prefix.endsWith('/') && !/\/{2,}|\s/.test(prefix)
}

export function callHass(payload: HassActionPayload): Promise<CallApiResult> {
  return new Promise((resolve) => {
    const sock = zwaveSocket.raw
    if (!sock || !zwaveSocket.connected) {
      resolve({ success: false, message: 'Socket not connected' })
      return
    }
    sock.emit(InboundEvent.hass, payload, (response: CallApiResult) => resolve(response))
  })
}

export function rediscoverNode(nodeId: number): Promise<CallApiResult> {
  return callHass({ apiName: 'rediscoverNode', nodeId })
}

export function disableNodeDiscovery(nodeId: number): Promise<CallApiResult> {
  return callHass({ apiName: 'disableDiscovery', nodeId })
}

export function discoverDevice(nodeId: number, device: unknown): Promise<CallApiResult> {
  return callHass({ apiName: 'discover', nodeId, device })
}

export function deleteDevice(nodeId: number, device: unknown): Promise<CallApiResult> {
  return callHass({ apiName: 'delete', nodeId, device })
}

export function addDevice(nodeId: number, device: unknown): Promise<CallApiResult> {
  return callHass({ apiName: 'add', nodeId, device })
}

export function updateDevice(nodeId: number, device: unknown): Promise<CallApiResult> {
  return callHass({ apiName: 'update', nodeId, device })
}

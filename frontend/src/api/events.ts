/**
 * Socket.IO event + channel names, mirrored from the backend
 * (api/lib/SocketEvents.ts). Kept in sync manually so the frontend does not
 * depend on backend source.
 */

/** Server -> client events. */
export const SocketEvent = {
  init: 'INIT',
  controller: 'CONTROLLER_CMD',
  connected: 'CONNECTED',
  nodeFound: 'NODE_FOUND',
  nodeAdded: 'NODE_ADDED',
  nodeRemoved: 'NODE_REMOVED',
  nodeUpdated: 'NODE_UPDATED',
  valueUpdated: 'VALUE_UPDATED',
  valueRemoved: 'VALUE_REMOVED',
  metadataUpdated: 'METADATA_UPDATED',
  rebuildRoutesProgress: 'REBUILD_ROUTES_PROGRESS',
  healthCheckProgress: 'HEALTH_CHECK_PROGRESS',
  info: 'INFO',
  api: 'API_RETURN',
  debug: 'DEBUG',
  statistics: 'STATISTICS',
  nodeEvent: 'NODE_EVENT',
  grantSecurityClasses: 'GRANT_SECURITY_CLASSES',
  validateDSK: 'VALIDATE_DSK',
  inclusionAborted: 'INCLUSION_ABORTED',
  znifferFrame: 'ZNIFFER_FRAME',
  znifferState: 'ZNIFFER_STATE',
  linkReliability: 'LINK_RELIABILITY',
  otwFirmwareUpdate: 'OTW_FIRMWARE_UPDATE',
} as const

export type SocketEventName = (typeof SocketEvent)[keyof typeof SocketEvent]

/** Client -> server events. */
export const InboundEvent = {
  init: 'INITED',
  zwave: 'ZWAVE_API',
  hass: 'HASS_API',
  mqtt: 'MQTT_API',
  zniffer: 'ZNIFFER_API',
  subscribe: 'SUBSCRIBE',
  unsubscribe: 'UNSUBSCRIBE',
} as const

/**
 * Event channels (rooms). The backend emits most events to a room, so the
 * client must SUBSCRIBE to a channel to receive its events.
 */
export const Channel = {
  controller: 'controller',
  nodes: 'nodes',
  values: 'values',
  statistics: 'statistics',
  firmware: 'firmware',
  debug: 'debug',
  znifferFrames: 'znifferFrames',
  znifferState: 'znifferState',
  rebuild: 'rebuild',
  diagnostics: 'diagnostics',
} as const

export type ChannelName = (typeof Channel)[keyof typeof Channel]

/** Channels needed for the core live dashboard. */
export const CORE_CHANNELS: ChannelName[] = [Channel.controller, Channel.nodes, Channel.values]

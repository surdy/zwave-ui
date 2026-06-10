import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InboundEvent } from '@/api/events'
import {
  callHass,
  deleteDevice,
  disableNodeDiscovery,
  fromSettings,
  GATEWAY_TYPE,
  isValidHost,
  isValidPort,
  isValidPrefix,
  PAYLOAD_TYPE,
  rediscoverNode,
  toSettingsPatch,
  updateDevice,
} from '../integrations'

const socketMock = vi.hoisted(() => ({
  connected: true,
  emit: vi.fn(),
}))

vi.mock('@/api/socket', () => ({
  zwaveSocket: {
    get connected() {
      return socketMock.connected
    },
    get raw() {
      return socketMock.connected ? { emit: socketMock.emit } : null
    },
  },
}))

describe('settings integrations', () => {
  beforeEach(() => {
    socketMock.connected = true
    socketMock.emit.mockReset()
    socketMock.emit.mockImplementation((_event, _payload, ack) => {
      ack({ success: true, message: 'ok' })
    })
  })

  it('round-trips mqtt and gateway settings through the form', () => {
    const form = fromSettings({
      settings: {
        mqtt: {
          name: 'zwave',
          host: 'mqtt.local',
          port: 1884,
          disabled: false,
          reconnectPeriod: 5000,
          prefix: 'zwave/home',
          qos: 2,
          retain: false,
          clean: false,
          store: true,
          allowSelfsigned: true,
          key: '/certs/key.pem',
          cert: '/certs/cert.pem',
          ca: '/certs/ca.pem',
          auth: true,
          username: 'user',
          password: 'secret',
          customMqtt: 'preserved',
        },
        gateway: {
          type: GATEWAY_TYPE.NAMED,
          payloadType: PAYLOAD_TYPE.RAW,
          nodeNames: false,
          ignoreLoc: true,
          sendEvents: true,
          ignoreStatus: true,
          includeNodeInfo: true,
          publishNodeDetails: true,
          retainedDiscovery: false,
          entityTemplate: 'custom',
          hassDiscovery: true,
          discoveryPrefix: 'ha',
          useLocationAsSuggestedArea: true,
          manualDiscovery: true,
          logEnabled: true,
          logLevel: 'debug',
          logToFile: true,
          values: [{ topic: 'kept' }],
        },
      },
    })

    expect(form.mqtt.enabled).toBe(true)
    expect(form.mqtt.qos).toBe(2)
    expect(form.gateway.type).toBe(GATEWAY_TYPE.NAMED)
    expect(form.gateway.payloadType).toBe(PAYLOAD_TYPE.RAW)

    expect(toSettingsPatch(form)).toEqual({
      mqtt: {
        name: 'zwave',
        host: 'mqtt.local',
        port: 1884,
        disabled: false,
        reconnectPeriod: 5000,
        prefix: 'zwave/home',
        qos: 2,
        retain: false,
        clean: false,
        store: true,
        allowSelfsigned: true,
        key: '/certs/key.pem',
        cert: '/certs/cert.pem',
        ca: '/certs/ca.pem',
        auth: true,
        username: 'user',
        password: 'secret',
        customMqtt: 'preserved',
      },
      gateway: {
        type: GATEWAY_TYPE.NAMED,
        payloadType: PAYLOAD_TYPE.RAW,
        nodeNames: false,
        ignoreLoc: true,
        sendEvents: true,
        ignoreStatus: true,
        includeNodeInfo: true,
        publishNodeDetails: true,
        retainedDiscovery: false,
        entityTemplate: 'custom',
        hassDiscovery: true,
        discoveryPrefix: 'ha',
        useLocationAsSuggestedArea: true,
        manualDiscovery: true,
        logEnabled: true,
        logLevel: 'debug',
        logToFile: true,
        values: [{ topic: 'kept' }],
      },
    })
  })

  it('validates hosts, ports, and MQTT prefixes', () => {
    expect(isValidHost('mqtt.local')).toBe(true)
    expect(isValidHost('broker name')).toBe(false)
    expect(isValidHost('')).toBe(false)

    expect(isValidPort(1883)).toBe(true)
    expect(isValidPort(0)).toBe(false)
    expect(isValidPort(65536)).toBe(false)
    expect(isValidPort(null)).toBe(false)

    expect(isValidPrefix('zwave/home')).toBe(true)
    expect(isValidPrefix('/zwave')).toBe(false)
    expect(isValidPrefix('zwave//home')).toBe(false)
    expect(isValidPrefix('zwave home')).toBe(false)
  })

  it('emits Home Assistant actions and resolves acknowledgements', async () => {
    await expect(rediscoverNode(7)).resolves.toEqual({ success: true, message: 'ok' })
    expect(socketMock.emit).toHaveBeenLastCalledWith(
      InboundEvent.hass,
      { apiName: 'rediscoverNode', nodeId: 7 },
      expect.any(Function),
    )

    await disableNodeDiscovery(8)
    expect(socketMock.emit).toHaveBeenLastCalledWith(
      InboundEvent.hass,
      { apiName: 'disableDiscovery', nodeId: 8 },
      expect.any(Function),
    )

    const device = { id: 'sensor', type: 'sensor' }
    await deleteDevice(9, device)
    expect(socketMock.emit).toHaveBeenLastCalledWith(
      InboundEvent.hass,
      { apiName: 'delete', nodeId: 9, device },
      expect.any(Function),
    )

    await updateDevice(9, device)
    expect(socketMock.emit).toHaveBeenLastCalledWith(
      InboundEvent.hass,
      { apiName: 'update', nodeId: 9, device },
      expect.any(Function),
    )
  })

  it('returns an error result when the socket is disconnected', async () => {
    socketMock.connected = false

    await expect(callHass({ apiName: 'rediscoverNode', nodeId: 1 })).resolves.toEqual({
      success: false,
      message: 'Socket not connected',
    })
    expect(socketMock.emit).not.toHaveBeenCalled()
  })
})

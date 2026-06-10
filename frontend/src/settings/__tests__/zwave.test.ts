import { describe, expect, it } from 'vitest'
import {
  fromSettings,
  generateSecurityKey,
  hasZwaveErrors,
  isValidHexKey,
  isValidPort,
  isValidRemoteUrl,
  toSettingsPatch,
  validateZwaveForm,
} from '../zwave'

describe('z-wave settings mapping', () => {
  it('round-trips settings to form and patch', () => {
    const form = fromSettings({
      settings: {
        zwave: {
          enabled: true,
          port: 'tcp://127.0.0.1:5555',
          rf: { region: 1 },
          logLevel: 'debug',
          enableSoftReset: false,
          serverEnabled: true,
          serverPort: 3001,
          commandsTimeout: 45,
          securityKeys: {
            S0_Legacy: '00000000000000000000000000000000',
            S2_Unauthenticated: '11111111111111111111111111111111',
            S2_Authenticated: '22222222222222222222222222222222',
            S2_AccessControl: '33333333333333333333333333333333',
          },
          securityKeysLongRange: {
            S2_Authenticated: '44444444444444444444444444444444',
            S2_AccessControl: '55555555555555555555555555555555',
          },
        },
      },
    })

    expect(form).toMatchObject({
      enabled: true,
      port: 'tcp://127.0.0.1:5555',
      rfRegion: 1,
      logLevel: 'debug',
      enableSoftReset: false,
      serverEnabled: true,
      serverPort: 3001,
      commandsTimeout: 45,
    })
    expect(toSettingsPatch(form)).toEqual({
      zwave: {
        enabled: true,
        port: 'tcp://127.0.0.1:5555',
        rf: { region: 1 },
        logLevel: 'debug',
        enableSoftReset: false,
        serverEnabled: true,
        serverPort: 3001,
        commandsTimeout: 45,
        securityKeys: {
          S0_Legacy: '00000000000000000000000000000000',
          S2_Unauthenticated: '11111111111111111111111111111111',
          S2_Authenticated: '22222222222222222222222222222222',
          S2_AccessControl: '33333333333333333333333333333333',
        },
        securityKeysLongRange: {
          S2_Authenticated: '44444444444444444444444444444444',
          S2_AccessControl: '55555555555555555555555555555555',
        },
      },
    })
  })
})

describe('z-wave settings security keys', () => {
  it('generates 16-byte hex security keys', () => {
    const key = generateSecurityKey()

    expect(key).toHaveLength(32)
    expect(isValidHexKey(key)).toBe(true)
  })
})

describe('z-wave settings validators', () => {
  it('validates hex keys', () => {
    expect(isValidHexKey('abcdef1234567890ABCDEF1234567890')).toBe(true)
    expect(isValidHexKey('abcdef')).toBe(false)
    expect(isValidHexKey('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false)
  })

  it('validates ports', () => {
    expect(isValidPort(1)).toBe(true)
    expect(isValidPort('65535')).toBe(true)
    expect(isValidPort(0)).toBe(false)
    expect(isValidPort(65536)).toBe(false)
    expect(isValidPort('abc')).toBe(false)
  })

  it('validates remote URLs', () => {
    expect(isValidRemoteUrl('tcp://127.0.0.1:5555')).toBe(true)
    expect(isValidRemoteUrl('ws://zwave.example.test:3000')).toBe(true)
    expect(isValidRemoteUrl('wss://zwave.example.test/socket')).toBe(true)
    expect(isValidRemoteUrl('tcp://127.0.0.1')).toBe(false)
    expect(isValidRemoteUrl('http://zwave.example.test')).toBe(false)
    expect(isValidRemoteUrl('not a url')).toBe(false)
  })

  it('validates the full form', () => {
    const form = fromSettings({ settings: { zwave: { enabled: true } } })

    expect(hasZwaveErrors(validateZwaveForm(form))).toBe(true)
    form.port = 'tcp://127.0.0.1:5555'
    form.serverEnabled = true
    form.serverPort = 70000
    form.securityKeys.S2_Authenticated = 'bad'
    expect(validateZwaveForm(form)).toMatchObject({
      serverPort: 'Use a server port between 1 and 65535.',
      securityKeys: { S2_Authenticated: 'Use exactly 32 hexadecimal characters.' },
    })

    form.serverPort = 3000
    form.securityKeys.S2_Authenticated = 'abcdef1234567890abcdef1234567890'
    expect(hasZwaveErrors(validateZwaveForm(form))).toBe(false)
  })
})

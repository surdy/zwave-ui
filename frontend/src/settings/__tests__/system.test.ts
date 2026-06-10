import { describe, expect, it } from 'vitest'
import {
  fromSettings,
  isValidNewPassword,
  parseHealth,
  parseVersion,
  passwordsMatch,
  toSettingsPatch,
} from '../system'

describe('system version parsing', () => {
  it('normalizes version responses', () => {
    expect(parseVersion({ appVersion: '1.2.3', zwavejs: '14.0.0', zwavejsServer: '1.40.0' })).toEqual({
      appVersion: '1.2.3',
      zwavejs: '14.0.0',
      zwavejsServer: '1.40.0',
    })
    expect(parseVersion({})).toEqual({ appVersion: 'Unknown', zwavejs: 'Unknown', zwavejsServer: 'Unknown' })
  })
})

describe('system health parsing', () => {
  it('maps 200 responses to healthy', () => {
    expect(
      parseHealth(
        { status: 200, text: 'Ok' },
        { status: 204, text: 'Ok' },
        { status: 299, text: 'Ok' },
      ),
    ).toMatchObject({ overall: true, zwave: true, mqtt: true })
  })

  it('maps 500 responses to unhealthy', () => {
    expect(
      parseHealth(
        { status: 500, text: 'Error' },
        { status: 503, text: 'Error' },
        { status: 0, text: 'Network error' },
      ),
    ).toMatchObject({ overall: false, zwave: false, mqtt: false })
  })
})

describe('system settings mapping', () => {
  it('round-trips auth and logging settings', () => {
    const form = fromSettings({
      settings: {
        gateway: {
          authEnabled: true,
          logEnabled: true,
          logLevel: 'debug',
          logToFile: true,
          plugins: ['custom'],
        },
        zwave: {
          logEnabled: true,
          logLevel: 'silly',
          logToFile: false,
          port: '/dev/ttyUSB0',
        },
      },
    })

    expect(form).toMatchObject({
      authEnabled: true,
      gatewayLogEnabled: true,
      gatewayLogLevel: 'debug',
      gatewayLogToFile: true,
      zwaveLogEnabled: true,
      zwaveLogLevel: 'silly',
      zwaveLogToFile: false,
    })
    expect(toSettingsPatch(form)).toEqual({
      gateway: {
        plugins: ['custom'],
        authEnabled: true,
        logEnabled: true,
        logLevel: 'debug',
        logToFile: true,
      },
      zwave: {
        port: '/dev/ttyUSB0',
        logEnabled: true,
        logLevel: 'silly',
        logToFile: false,
      },
    })
  })
})

describe('system password validators', () => {
  it('validates new password length', () => {
    expect(isValidNewPassword('12345678')).toBe(true)
    expect(isValidNewPassword('1234567')).toBe(false)
  })

  it('validates matching passwords', () => {
    expect(passwordsMatch('correct horse', 'correct horse')).toBe(true)
    expect(passwordsMatch('correct horse', 'battery staple')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  bytesFromValue,
  bytesToBlob,
  flattenStoreEntries,
  fromSettings,
  getStoreRootPath,
  isValidCron,
  restoreConfirmationMatches,
  toSettingsPatch,
} from '../backup'

describe('backup settings mapping', () => {
  it('round-trips the upstream backup schedule shape', () => {
    const form = fromSettings({
      settings: {
        backup: {
          storeBackup: true,
          storeCron: '10 9 * * *',
          storeKeep: 5,
          nvmBackup: true,
          nvmBackupOnEvent: true,
          nvmCron: '19 9 * * 1-5',
          nvmKeep: 9,
        },
      },
    })

    expect(form).toEqual({
      storeBackup: true,
      storeCron: '10 9 * * *',
      storeKeep: 5,
      nvmBackup: true,
      nvmBackupOnEvent: true,
      nvmCron: '19 9 * * 1-5',
      nvmKeep: 9,
    })
    expect(toSettingsPatch(form)).toEqual({
      backup: {
        storeBackup: true,
        storeCron: '10 9 * * *',
        storeKeep: 5,
        nvmBackup: true,
        nvmBackupOnEvent: true,
        nvmCron: '19 9 * * 1-5',
        nvmKeep: 9,
      },
    })
  })
})

describe('cron validation', () => {
  it('accepts basic five-field cron expressions', () => {
    expect(isValidCron('0 0 * * *')).toBe(true)
    expect(isValidCron('*/15 9-17 * 1,6 1-5')).toBe(true)
    expect(isValidCron('59 23 31 12 7')).toBe(true)
  })

  it('rejects invalid cron expressions', () => {
    expect(isValidCron('0 0 * *')).toBe(false)
    expect(isValidCron('60 0 * * *')).toBe(false)
    expect(isValidCron('0 24 * * *')).toBe(false)
    expect(isValidCron('0 0 0 * *')).toBe(false)
    expect(isValidCron('0 0 * JAN *')).toBe(false)
    expect(isValidCron('*/0 0 * * *')).toBe(false)
  })
})

describe('store backup flattening', () => {
  it('finds backup files in nested /api/store payloads newest first', () => {
    const payload = [
      {
        name: 'store',
        path: '/usr/src/app/store',
        isRoot: true,
        children: [
          { name: 'settings.json', path: '/usr/src/app/store/settings.json', size: '4 KB' },
          {
            name: 'backups',
            path: '/usr/src/app/store/backups',
            children: [
              {
                name: 'store',
                path: '/usr/src/app/store/backups/store',
                children: [{ name: 'store-backup_20260610210000.zip', path: '/usr/src/app/store/backups/store/store-backup_20260610210000.zip', size: '10 KB' }],
              },
              {
                name: 'nvm',
                path: '/usr/src/app/store/backups/nvm',
                children: [{ name: 'NVM_20260610220000.bin', path: '/usr/src/app/store/backups/nvm/NVM_20260610220000.bin', size: '128 KB' }],
              },
            ],
          },
        ],
      },
    ]

    expect(getStoreRootPath(payload)).toBe('/usr/src/app/store')
    expect(flattenStoreEntries(payload)).toMatchObject([
      { name: 'NVM_20260610220000.bin', kind: 'nvm', directory: '/usr/src/app/store/backups/nvm' },
      { name: 'store-backup_20260610210000.zip', kind: 'store', directory: '/usr/src/app/store/backups/store' },
    ])
  })
})

describe('restore guard and bytes helpers', () => {
  it('requires exact RESTORE text after trimming', () => {
    expect(restoreConfirmationMatches(' RESTORE ')).toBe(true)
    expect(restoreConfirmationMatches('restore')).toBe(false)
    expect(restoreConfirmationMatches('RESTORE!')).toBe(false)
    expect(restoreConfirmationMatches(null)).toBe(false)
  })

  it('normalizes Buffer-like data and creates blobs', () => {
    const bytes = bytesFromValue({ data: [1, 2, 'x', 3] })
    expect([...bytes]).toEqual([1, 2, 3])
    expect(bytesToBlob(bytes).size).toBe(3)
  })
})

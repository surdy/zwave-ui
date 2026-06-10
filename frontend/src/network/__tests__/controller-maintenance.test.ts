import { beforeEach, describe, expect, it, vi } from 'vitest'

const { callApi } = vi.hoisted(() => ({ callApi: vi.fn() }))

vi.mock('@/api', () => ({
  zwaveSocket: { callApi },
}))

import {
  backupNVMRaw,
  beginRebuildingRoutes,
  confirmationMatches,
  firmwareUpdateOTW,
  hardReset,
  initialRebuildProgressState,
  nvmBackupFilename,
  parseRebuildProgress,
  rebuildPercent,
  rebuildProgressReducer,
  requiresTypedConfirmation,
  restart,
  restoreNVM,
  setMaxLRPowerLevel,
  setPowerlevel,
  setRFRegion,
  shutdownZwaveAPI,
  softReset,
  stopRebuildingRoutes,
} from '../controller-maintenance'

describe('rebuild progress', () => {
  it('parses tuple, object, and map-like rebuild payloads', () => {
    expect(parseRebuildProgress([[2, 'pending']])).toEqual({ type: 'progress', entries: [{ nodeId: 2, status: 'pending' }] })
    expect(parseRebuildProgress({ nodeId: '3', status: 'done' })).toEqual({ type: 'progress', entries: [{ nodeId: 3, status: 'done' }] })
    expect(parseRebuildProgress({ 4: 'failed', 5: 'skipped' })).toEqual({
      type: 'progress',
      entries: [
        { nodeId: 4, status: 'failed' },
        { nodeId: 5, status: 'skipped' },
      ],
    })
  })

  it('reduces per-node progress and computes percent', () => {
    let state = rebuildProgressReducer(initialRebuildProgressState(), { type: 'start', total: 3 })
    expect(state).toMatchObject({ phase: 'running', total: 3, done: 0 })

    state = rebuildProgressReducer(state, parseRebuildProgress([[2, 'pending'], [3, 'done']])!)
    expect(state).toMatchObject({ phase: 'running', done: 1, total: 3 })
    expect(rebuildPercent(state)).toBe(33)

    state = rebuildProgressReducer(state, parseRebuildProgress([[2, 'failed'], [4, 'skipped']])!)
    expect(state).toMatchObject({ phase: 'complete', done: 3, total: 3 })
    expect(rebuildPercent(state)).toBe(100)
  })
})

describe('confirmation guards', () => {
  it('requires typed confirmation for irreversible actions only', () => {
    expect(requiresTypedConfirmation('hard-reset')).toBe(true)
    expect(requiresTypedConfirmation('nvm-restore')).toBe(true)
    expect(requiresTypedConfirmation('soft-reset')).toBe(false)
  })

  it('matches typed confirmations exactly after trimming', () => {
    expect(confirmationMatches('ERASE', ' ERASE ')).toBe(true)
    expect(confirmationMatches('Controller A', 'Controller A')).toBe(true)
    expect(confirmationMatches('ERASE', 'erase')).toBe(false)
    expect(confirmationMatches('ERASE', 'ERASE!')).toBe(false)
    expect(confirmationMatches('ERASE', null)).toBe(false)
    expect(confirmationMatches('', '')).toBe(false)
  })

  it('creates stable NVM backup filenames', () => {
    expect(nvmBackupFilename(new Date('2026-06-10T21:28:40.675Z'))).toBe('zwave-controller-nvm-2026-06-10_21-28-40-675.bin')
  })
})

describe('controller maintenance API wrappers', () => {
  beforeEach(() => {
    callApi.mockReset()
    callApi.mockResolvedValue({ success: true, message: 'ok' })
  })

  it('calls controller APIs with expected names and arguments', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const firmware = { name: 'ctrl.bin', data: bytes }

    await beginRebuildingRoutes({ strategy: 'all' })
    await beginRebuildingRoutes()
    await stopRebuildingRoutes()
    await backupNVMRaw()
    await restoreNVM(bytes)
    await restoreNVM(bytes, true)
    await setRFRegion(1)
    await setPowerlevel(-1, 0)
    await setMaxLRPowerLevel(14)
    await firmwareUpdateOTW(firmware)
    await softReset()
    await hardReset()
    await restart()
    await shutdownZwaveAPI()

    expect(callApi).toHaveBeenNthCalledWith(1, 'beginRebuildingRoutes', { strategy: 'all' })
    expect(callApi).toHaveBeenNthCalledWith(2, 'beginRebuildingRoutes')
    expect(callApi).toHaveBeenNthCalledWith(3, 'stopRebuildingRoutes')
    expect(callApi).toHaveBeenNthCalledWith(4, 'backupNVMRaw')
    expect(callApi).toHaveBeenNthCalledWith(5, 'restoreNVM', bytes)
    expect(callApi).toHaveBeenNthCalledWith(6, 'restoreNVM', bytes, true)
    expect(callApi).toHaveBeenNthCalledWith(7, 'setRFRegion', 1)
    expect(callApi).toHaveBeenNthCalledWith(8, 'setPowerlevel', -1, 0)
    expect(callApi).toHaveBeenNthCalledWith(9, 'setMaxLRPowerLevel', 14)
    expect(callApi).toHaveBeenNthCalledWith(10, 'firmwareUpdateOTW', firmware)
    expect(callApi).toHaveBeenNthCalledWith(11, 'softReset')
    expect(callApi).toHaveBeenNthCalledWith(12, 'hardReset')
    expect(callApi).toHaveBeenNthCalledWith(13, 'restart')
    expect(callApi).toHaveBeenNthCalledWith(14, 'shutdownZwaveAPI')
  })
})

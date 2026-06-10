import { describe, expect, it, vi } from 'vitest'
import type { ZwaveNode } from '@/api'
import {
  abortFirmwareUpdate,
  applyProgress,
  canStartUpdate,
  dismissFirmwareUpdate,
  firmwareReducer,
  firmwareUpdateOTA,
  getAvailableFirmwareUpdates,
  getNodeFirmwareUpdates,
  initialFirmwareState,
  parseUpdateResult,
  progressPercent,
  updateFirmware,
  type FirmwareUpdateInfo,
  type ManualFirmwareFile,
} from '../firmware'

vi.mock('@/api', () => ({
  zwaveSocket: {
    callApi: vi.fn().mockResolvedValue({ success: true, message: 'ok', result: [] }),
  },
}))

function node(overrides: Partial<ZwaveNode> = {}): ZwaveNode {
  return {
    id: 2,
    ready: true,
    available: true,
    failed: false,
    inited: true,
    status: 'Alive',
    ...overrides,
  }
}

describe('firmware state machine', () => {
  it('transitions idle → checking → available → updating → success', () => {
    const update: FirmwareUpdateInfo = { version: '1.2.3', channel: 'stable' }
    let state = initialFirmwareState()

    state = firmwareReducer(state, { type: 'check' })
    expect(state.phase).toBe('checking')

    state = firmwareReducer(state, { type: 'available', updates: [update] })
    expect(state).toMatchObject({ phase: 'available', updates: [update] })

    state = firmwareReducer(state, { type: 'start' })
    expect(state).toMatchObject({ phase: 'updating', percent: 0 })

    state = firmwareReducer(state, { type: 'success', result: { success: true, message: 'done' } })
    expect(state).toMatchObject({ phase: 'success', percent: 100, status: 'done' })
  })

  it('transitions updating → error and updating → aborted', () => {
    const updating = firmwareReducer(initialFirmwareState(), { type: 'start' })

    expect(firmwareReducer(updating, { type: 'error', error: 'checksum failed' })).toMatchObject({
      phase: 'error',
      error: 'checksum failed',
    })
    expect(firmwareReducer(updating, { type: 'aborted' })).toMatchObject({
      phase: 'aborted',
      status: 'Firmware update aborted',
    })
  })

  it('computes progress from explicit and fragment progress', () => {
    expect(progressPercent({ progress: 48.5 })).toBe(49)
    expect(progressPercent({ sentFragments: 25, totalFragments: 100 })).toBe(25)
    expect(progressPercent({ currentFile: 2, totalFiles: 4, sentFragments: 50, totalFragments: 100 })).toBe(38)
    expect(progressPercent({ progress: 150 })).toBe(100)

    const state = applyProgress(initialFirmwareState(), { sentFragments: 3, totalFragments: 10 })
    expect(state).toMatchObject({ phase: 'updating', percent: 30 })
  })

  it('guards against concurrent updates and unavailable nodes', () => {
    expect(canStartUpdate(initialFirmwareState(), node())).toBe(true)
    expect(canStartUpdate(firmwareReducer(initialFirmwareState(), { type: 'start' }), node())).toBe(false)
    expect(canStartUpdate(initialFirmwareState(), node({ available: false }))).toBe(false)
    expect(canStartUpdate(initialFirmwareState(), node({ failed: true }))).toBe(false)
    expect(canStartUpdate(initialFirmwareState(), node({ status: 'Dead' }))).toBe(false)
    expect(canStartUpdate(initialFirmwareState(), node({ status: 'Asleep' }))).toBe(false)
  })

  it('parses success and failure update results', () => {
    expect(parseUpdateResult({ success: true, result: { success: true, status: 'OK', reInterview: true, waitTime: 5 } })).toMatchObject({
      success: true,
      status: 'OK',
      reInterview: true,
      waitTime: 5,
    })
    expect(parseUpdateResult({ success: false, message: 'driver not ready' })).toMatchObject({
      success: false,
      message: 'driver not ready',
    })
    expect(parseUpdateResult({ success: true, result: { success: false, status: 'Error_Checksum' } })).toMatchObject({
      success: false,
      status: 'Error_Checksum',
    })
  })
})

describe('firmware API wrappers', () => {
  it('calls the zwave API with the expected method names and arguments', async () => {
    const { zwaveSocket } = await import('@/api')
    const update: FirmwareUpdateInfo = { version: '2.0.0' }
    const files: ManualFirmwareFile[] = [{ name: 'fw.bin', data: new Uint8Array([1, 2, 3]), target: 0 }]

    await getAvailableFirmwareUpdates(2)
    await getNodeFirmwareUpdates(2)
    await firmwareUpdateOTA(2, update)
    await updateFirmware(2, files)
    await abortFirmwareUpdate(2)
    await dismissFirmwareUpdate(2, '2.0.0')

    expect(zwaveSocket.callApi).toHaveBeenCalledWith('getAvailableFirmwareUpdates', 2)
    expect(zwaveSocket.callApi).toHaveBeenCalledWith('getNodeFirmwareUpdates', 2)
    expect(zwaveSocket.callApi).toHaveBeenCalledWith('firmwareUpdateOTA', 2, update)
    expect(zwaveSocket.callApi).toHaveBeenCalledWith('updateFirmware', 2, files)
    expect(zwaveSocket.callApi).toHaveBeenCalledWith('abortFirmwareUpdate', 2)
    expect(zwaveSocket.callApi).toHaveBeenCalledWith('dismissFirmwareUpdate', 2, '2.0.0')
  })
})

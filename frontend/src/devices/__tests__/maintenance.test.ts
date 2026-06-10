import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZwaveNode } from '@/api'

const { callApi } = vi.hoisted(() => ({ callApi: vi.fn() }))

vi.mock('@/api', () => ({
  zwaveSocket: { callApi },
}))

import {
  confirmRemoveFailed,
  defaultMaintenanceApi,
  eventMatchesNode,
  formatNodeEvent,
  getNodeNeighbors,
  isFailedNode,
  maintenanceActions,
  performMaintenanceAction,
  pushEvent,
  rebuildNodeRoutes,
  refreshNeighbors,
  removeFailedNode,
  shouldOfferRemoveFailed,
  syncNodeDateAndTime,
} from '../maintenance'

function node(p: Partial<ZwaveNode> & { id?: number } = {}): ZwaveNode {
  return {
    id: 2,
    ready: true,
    available: true,
    failed: false,
    inited: true,
    ...p,
  } as ZwaveNode
}

describe('maintenance API wrappers', () => {
  beforeEach(() => {
    callApi.mockReset()
    callApi.mockResolvedValue({ success: true, message: 'ok' })
  })

  it('calls the backend APIs with the expected arguments', async () => {
    await defaultMaintenanceApi.refreshInfo(2)
    await defaultMaintenanceApi.refreshValues(2)
    await defaultMaintenanceApi.pingNode(2)
    await rebuildNodeRoutes(2)
    await isFailedNode(2)
    await removeFailedNode(2)
    await syncNodeDateAndTime(2)
    await getNodeNeighbors(2)
    await refreshNeighbors()

    expect(callApi).toHaveBeenNthCalledWith(1, 'refreshInfo', 2)
    expect(callApi).toHaveBeenNthCalledWith(2, 'refreshValues', 2)
    expect(callApi).toHaveBeenNthCalledWith(3, 'pingNode', 2)
    expect(callApi).toHaveBeenNthCalledWith(4, 'rebuildNodeRoutes', 2)
    expect(callApi).toHaveBeenNthCalledWith(5, 'isFailedNode', 2)
    expect(callApi).toHaveBeenNthCalledWith(6, 'removeFailedNode', 2)
    expect(callApi).toHaveBeenNthCalledWith(7, 'syncNodeDateAndTime', 2)
    expect(callApi).toHaveBeenNthCalledWith(8, 'getNodeNeighbors', 2)
    expect(callApi).toHaveBeenNthCalledWith(9, 'refreshNeighbors')
  })

  it('passes an explicit date to syncNodeDateAndTime when provided', async () => {
    const date = new Date('2026-01-02T03:04:05Z')
    await syncNodeDateAndTime(2, date)
    expect(callApi).toHaveBeenCalledWith('syncNodeDateAndTime', 2, date)
  })
})

describe('maintenance action handlers', () => {
  beforeEach(() => {
    callApi.mockReset()
    callApi.mockResolvedValue({ success: true, message: 'ok', result: true })
  })

  it('dispatches each non-destructive action to the correct API', async () => {
    await performMaintenanceAction(defaultMaintenanceApi, 2, 'refresh-info')
    await performMaintenanceAction(defaultMaintenanceApi, 2, 'refresh-values')
    await performMaintenanceAction(defaultMaintenanceApi, 2, 'ping')
    await performMaintenanceAction(defaultMaintenanceApi, 2, 'rebuild-routes')
    await performMaintenanceAction(defaultMaintenanceApi, 2, 'sync-time')
    await performMaintenanceAction(defaultMaintenanceApi, 2, 'get-neighbors')

    expect(callApi.mock.calls.map((call) => call[0])).toEqual([
      'refreshInfo',
      'refreshValues',
      'pingNode',
      'rebuildNodeRoutes',
      'syncNodeDateAndTime',
      'getNodeNeighbors',
    ])
  })

  it('checks isFailedNode before removing a failed node', async () => {
    const confirm = vi.fn().mockResolvedValue(true)

    await confirmRemoveFailed(defaultMaintenanceApi, 2, confirm)

    expect(callApi).toHaveBeenNthCalledWith(1, 'isFailedNode', 2)
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ danger: true }))
    expect(callApi).toHaveBeenNthCalledWith(2, 'removeFailedNode', 2)
  })

  it('does not remove a node when the controller says it is not failed', async () => {
    callApi.mockResolvedValueOnce({ success: true, message: 'ok', result: false })
    const confirm = vi.fn().mockResolvedValue(true)

    const result = await confirmRemoveFailed(defaultMaintenanceApi, 2, confirm)

    expect(result.success).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
    expect(callApi).toHaveBeenCalledTimes(1)
  })

  it('does not remove a failed node when confirmation is cancelled', async () => {
    const confirm = vi.fn().mockResolvedValue(false)

    const result = await performMaintenanceAction(defaultMaintenanceApi, 2, 'remove-failed', confirm)

    expect(result).toMatchObject({ success: true, result: false })
    expect(callApi).toHaveBeenCalledTimes(1)
    expect(callApi).toHaveBeenCalledWith('isFailedNode', 2)
  })
})

describe('maintenance pure helpers', () => {
  it('offers remove-failed only for dead or failed nodes', () => {
    expect(shouldOfferRemoveFailed(node({ failed: true }))).toBe(true)
    expect(shouldOfferRemoveFailed(node({ status: 'Dead' }))).toBe(true)
    expect(shouldOfferRemoveFailed(node({ status: 'Alive' }))).toBe(false)

    const remove = maintenanceActions(node({ failed: true })).find((action) => action.id === 'remove-failed')
    expect(remove).toMatchObject({ tier: 'expert', enabled: true, danger: true })
  })

  it('caps the activity ring buffer with newest items first', () => {
    const seed = [
      { time: 1, label: 'one' },
      { time: 0, label: 'zero' },
    ]
    expect(pushEvent(seed, { time: 2, label: 'two' }, 2)).toEqual([
      { time: 2, label: 'two' },
      { time: 1, label: 'one' },
    ])
    expect(seed).toHaveLength(2)
  })

  it('formats node events and value updates', () => {
    const event = formatNodeEvent({
      nodeId: 2,
      event: { time: '2026-06-10T20:00:00.000Z', event: 'notification', args: ['Home Security', 7] },
    })
    expect(event).toMatchObject({ label: 'Notification', detail: 'Home Security · 7' })
    expect(event.time).toBe(Date.parse('2026-06-10T20:00:00.000Z'))

    const value = formatNodeEvent({
      nodeId: 2,
      commandClassName: 'Binary Switch',
      propertyName: 'Current value',
      value: true,
    })
    expect(value).toMatchObject({ label: 'Current value updated', detail: 'Binary Switch · value: true' })
  })

  it('matches common event payloads by node id', () => {
    expect(eventMatchesNode({ nodeId: 2 }, 2)).toBe(true)
    expect(eventMatchesNode({ node: { id: 2 } }, 2)).toBe(true)
    expect(eventMatchesNode({ valueId: { nodeId: 2 } }, 2)).toBe(true)
    expect(eventMatchesNode({ nodeId: 3 }, 2)).toBe(false)
  })
})

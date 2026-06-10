import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZwaveNode } from '@/api'

const { callApi } = vi.hoisted(() => ({ callApi: vi.fn() }))

vi.mock('@/api', () => ({
  zwaveSocket: { callApi },
}))

import {
  abortHealthCheck,
  buildMeshGraph,
  checkLifelineHealth,
  checkLinkReliability,
  checkRouteHealth,
  discoverNodeNeighbors,
  getNodeNeighbors,
  healthProgressReducer,
  networkCounts,
  parseHealthProgress,
  refreshNeighbors,
} from '../health'

function node(patch: Partial<ZwaveNode> & { id: number }): ZwaveNode {
  return {
    ready: true,
    available: true,
    failed: false,
    inited: true,
    status: 'Alive',
    ...patch,
  } as ZwaveNode
}

describe('buildMeshGraph', () => {
  it('dedupes undirected neighbor edges and colors nodes by status', () => {
    const graph = buildMeshGraph(
      [
        node({ id: 1, name: 'Controller', isControllerNode: true, neighbors: [2] }),
        node({ id: 2, name: 'Plug', neighbors: [1, 3] }),
        node({ id: 3, name: 'Sleepy', status: 'Asleep', neighbors: [2, 2] }),
        node({ id: 4, name: 'Dead', status: 'Dead', neighbors: [99] }),
      ],
      {
        1: [2],
        2: [1, 3],
        3: [2],
        4: [99],
      },
    )

    expect(graph.edges).toEqual([
      { id: '1-2', from: 1, to: 2 },
      { id: '2-3', from: 2, to: 3 },
    ])
    expect(graph.nodes.find((n) => n.id === 1)).toMatchObject({ group: 'controller', color: 'var(--color-primary)' })
    expect(graph.nodes.find((n) => n.id === 2)).toMatchObject({ status: 'ready', color: 'var(--ok)' })
    expect(graph.nodes.find((n) => n.id === 3)).toMatchObject({ status: 'asleep', color: 'var(--warn)' })
    expect(graph.nodes.find((n) => n.id === 4)).toMatchObject({ status: 'dead', color: 'var(--danger)' })
  })
})

describe('networkCounts', () => {
  it('counts statuses using device status semantics', () => {
    expect(
      networkCounts([
        node({ id: 1, status: 'Alive' }),
        node({ id: 2, status: 'Awake' }),
        node({ id: 3, status: 'Asleep' }),
        node({ id: 4, status: 'Dead' }),
        node({ id: 5, failed: true }),
        node({ id: 6, ready: false, status: 'Unknown' }),
      ]),
    ).toEqual({ total: 6, online: 2, asleep: 1, dead: 1, failed: 1 })
  })
})

describe('health progress', () => {
  it('parses upstream health progress payloads', () => {
    expect(
      parseHealthProgress({
        request: { nodeId: 4, targetNodeId: 1 },
        round: 2,
        totalRounds: 5,
        lastRating: 8,
        lastResult: { latency: 12 },
      }),
    ).toMatchObject({ nodeId: 4, targetNodeId: 1, roundsDone: 2, totalRounds: 5, rating: 8, phase: 'running', canAbort: true })
  })

  it('marks complete when all rounds are done and handles abort/error events', () => {
    let state = healthProgressReducer(null, { type: 'start', nodeId: 2, targetNodeId: 1, totalRounds: 3 })
    expect(state).toMatchObject({ phase: 'running', canAbort: true })

    const parsed = parseHealthProgress({ request: { nodeId: 2, targetNodeId: 1 }, round: 3, totalRounds: 3 })
    state = healthProgressReducer(state, parsed!)
    expect(state).toMatchObject({ phase: 'complete', canAbort: false })

    state = healthProgressReducer(state, { type: 'abort' })
    expect(state).toMatchObject({ phase: 'aborted', canAbort: false })

    state = healthProgressReducer(state, { type: 'error', message: 'boom' })
    expect(state).toMatchObject({ phase: 'error', canAbort: false, message: 'boom' })
  })
})

describe('network API wrappers', () => {
  beforeEach(() => {
    callApi.mockReset()
    callApi.mockResolvedValue({ success: true, message: 'ok' })
  })

  it('calls neighbor APIs with upstream args', async () => {
    await getNodeNeighbors(2)
    await refreshNeighbors()
    await discoverNodeNeighbors(3)

    expect(callApi).toHaveBeenNthCalledWith(1, 'getNodeNeighbors', 2)
    expect(callApi).toHaveBeenNthCalledWith(2, 'refreshNeighbors')
    expect(callApi).toHaveBeenNthCalledWith(3, 'discoverNodeNeighbors', 3)
  })

  it('calls health APIs with upstream args', async () => {
    await checkLifelineHealth(2, 5)
    await checkRouteHealth(2, 1, 3)
    await abortHealthCheck(2)
    await checkLinkReliability(2, { rounds: 4, testFrameCount: 10 })

    expect(callApi).toHaveBeenNthCalledWith(1, 'checkLifelineHealth', 2, 5)
    expect(callApi).toHaveBeenNthCalledWith(2, 'checkRouteHealth', 2, 1, 3)
    expect(callApi).toHaveBeenNthCalledWith(3, 'abortHealthCheck', 2)
    expect(callApi).toHaveBeenNthCalledWith(4, 'checkLinkReliability', 2, { rounds: 4, testFrameCount: 10 })
  })
})

import { zwaveSocket, type CallApiResult, type ZwaveNode } from '@/api'
import { deviceName, deviceStatus, type DeviceStatus } from '@/devices/model'

export type NeighborsMap = Record<number, readonly number[]> | Map<number, readonly number[]>

export interface GraphNode {
  id: number
  label: string
  title: string
  status: DeviceStatus
  group: DeviceStatus | 'controller'
  color: string
}

export interface GraphEdge {
  id: string
  from: number
  to: number
}

export interface MeshGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface NetworkCounts {
  total: number
  online: number
  asleep: number
  dead: number
  failed: number
}

export interface HealthProgress {
  nodeId: number
  targetNodeId?: number
  roundsDone: number
  totalRounds: number
  rating?: number
  phase: 'idle' | 'running' | 'complete' | 'aborted' | 'error'
  canAbort: boolean
  lastResult?: unknown
  message?: string
}

export type HealthProgressState = HealthProgress | null

export interface LinkReliabilityOptions {
  rounds?: number
  [key: string]: unknown
}

const STATUS_COLOR: Record<DeviceStatus | 'controller', string> = {
  controller: 'var(--color-primary)',
  ready: 'var(--ok)',
  asleep: 'var(--warn)',
  dead: 'var(--danger)',
  failed: 'var(--danger)',
  unknown: 'var(--color-text-muted)',
}

export function buildMeshGraph(nodes: readonly ZwaveNode[], neighborsMap: NeighborsMap): MeshGraph {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const graphNodes = nodes.map((node) => {
    const status = deviceStatus(node)
    const group: DeviceStatus | 'controller' = node.isControllerNode ? 'controller' : status
    return {
      id: node.id,
      label: `${node.id}: ${deviceName(node)}`,
      title: `${deviceName(node)} · ${status}`,
      status,
      group,
      color: STATUS_COLOR[group],
    }
  })

  const edgeIds = new Set<string>()
  for (const node of nodes) {
    for (const neighborId of neighborsFor(neighborsMap, node.id, node.neighbors)) {
      if (!nodeIds.has(neighborId) || neighborId === node.id) continue
      const [from, to] = node.id < neighborId ? [node.id, neighborId] : [neighborId, node.id]
      edgeIds.add(`${from}-${to}`)
    }
  }

  const edges = [...edgeIds]
    .sort((a, b) => numericEdge(a)[0] - numericEdge(b)[0] || numericEdge(a)[1] - numericEdge(b)[1])
    .map((id) => {
      const [from, to] = numericEdge(id)
      return { id, from, to }
    })

  return { nodes: graphNodes, edges }
}

export function networkCounts(nodes: readonly ZwaveNode[]): NetworkCounts {
  return nodes.reduce(
    (counts, node) => {
      counts.total += 1
      const status = deviceStatus(node)
      if (status === 'ready') counts.online += 1
      if (status === 'asleep') counts.asleep += 1
      if (status === 'dead') counts.dead += 1
      if (status === 'failed') counts.failed += 1
      return counts
    },
    { total: 0, online: 0, asleep: 0, dead: 0, failed: 0 },
  )
}

export function parseHealthProgress(payload: unknown): HealthProgress | null {
  if (!isRecord(payload)) return null
  const request = isRecord(payload.request) ? payload.request : payload
  const nodeId = asNumber(request.nodeId ?? payload.nodeId)
  if (nodeId === undefined) return null

  const round = asNumber(payload.round ?? payload.roundsDone ?? payload.currentRound) ?? 0
  const totalRounds = asNumber(payload.totalRounds ?? payload.roundsTotal ?? payload.rounds) ?? round
  const rating = asNumber(payload.lastRating ?? payload.rating)
  const phase = phaseFromPayload(payload, round, totalRounds)

  return {
    nodeId,
    targetNodeId: asNumber(request.targetNodeId ?? payload.targetNodeId),
    roundsDone: round,
    totalRounds,
    rating,
    phase,
    canAbort: phase === 'running',
    lastResult: payload.lastResult,
    message: typeof payload.message === 'string' ? payload.message : undefined,
  }
}

export function healthProgressReducer(
  state: HealthProgressState,
  event: HealthProgress | { type: 'start'; nodeId: number; targetNodeId?: number; totalRounds: number } | { type: 'abort' } | { type: 'error'; message: string },
): HealthProgressState {
  if ('type' in event) {
    if (event.type === 'start') {
      return {
        nodeId: event.nodeId,
        targetNodeId: event.targetNodeId,
        roundsDone: 0,
        totalRounds: event.totalRounds,
        phase: 'running',
        canAbort: true,
      }
    }
    if (event.type === 'abort' && state) return { ...state, phase: 'aborted', canAbort: false }
    if (event.type === 'error') {
      return {
        ...(state ?? { nodeId: 0, roundsDone: 0, totalRounds: 0 }),
        phase: 'error',
        canAbort: false,
        message: event.message,
      }
    }
  }

  const next = event as HealthProgress
  return { ...state, ...next, canAbort: next.phase === 'running' }
}

export function getNodeNeighbors(nodeId: number): Promise<CallApiResult<readonly number[]>> {
  return zwaveSocket.callApi('getNodeNeighbors', nodeId)
}

export function refreshNeighbors(): Promise<CallApiResult<Record<number, number[]>>> {
  return zwaveSocket.callApi('refreshNeighbors')
}

export function discoverNodeNeighbors(nodeId: number): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('discoverNodeNeighbors', nodeId)
}

export function checkLifelineHealth(nodeId: number, rounds?: number): Promise<CallApiResult> {
  return rounds === undefined
    ? zwaveSocket.callApi('checkLifelineHealth', nodeId)
    : zwaveSocket.callApi('checkLifelineHealth', nodeId, rounds)
}

export function checkRouteHealth(nodeId: number, targetNodeId: number, rounds?: number): Promise<CallApiResult> {
  return rounds === undefined
    ? zwaveSocket.callApi('checkRouteHealth', nodeId, targetNodeId)
    : zwaveSocket.callApi('checkRouteHealth', nodeId, targetNodeId, rounds)
}

export function abortHealthCheck(nodeId: number): Promise<CallApiResult> {
  return zwaveSocket.callApi('abortHealthCheck', nodeId)
}

export function checkLinkReliability(
  nodeId: number,
  options: LinkReliabilityOptions = {},
): Promise<CallApiResult> {
  return zwaveSocket.callApi('checkLinkReliability', nodeId, options)
}

function neighborsFor(map: NeighborsMap, nodeId: number, fallback?: readonly number[]): readonly number[] {
  if (map instanceof Map) return map.get(nodeId) ?? fallback ?? []
  return map[nodeId] ?? fallback ?? []
}

function numericEdge(edgeId: string): [number, number] {
  const [from, to] = edgeId.split('-').map(Number)
  return [from, to]
}

function phaseFromPayload(payload: Record<string, unknown>, round: number, totalRounds: number): HealthProgress['phase'] {
  const raw = String(payload.phase ?? payload.status ?? '').toLowerCase()
  if (raw === 'aborted' || raw === 'abort') return 'aborted'
  if (raw === 'error' || raw === 'failed') return 'error'
  if (raw === 'complete' || raw === 'done' || (totalRounds > 0 && round >= totalRounds)) return 'complete'
  return 'running'
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

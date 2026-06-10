import { zwaveSocket, type CallApiResult, type ZwaveNode } from '@/api'
import { pingNode as controlPingNode, refreshInfo as controlRefreshInfo, refreshValues as controlRefreshValues } from '@/devices/control'
import { deviceStatus } from '@/devices/model'

export type MaintenanceTier = 'advanced' | 'expert'

export type MaintenanceActionId =
  | 'refresh-info'
  | 'refresh-values'
  | 'ping'
  | 'rebuild-routes'
  | 'remove-failed'
  | 'sync-time'
  | 'get-neighbors'

export interface MaintenanceAction {
  id: MaintenanceActionId
  label: string
  description: string
  tier: MaintenanceTier
  enabled: boolean
  confirm?: boolean
  danger?: boolean
}

export interface ActivityFeedItem {
  time: number
  label: string
  detail?: string
}

export interface MaintenanceApi {
  refreshInfo: typeof refreshInfo
  refreshValues: typeof refreshValues
  pingNode: typeof pingNode
  rebuildNodeRoutes: typeof rebuildNodeRoutes
  isFailedNode: typeof isFailedNode
  removeFailedNode: typeof removeFailedNode
  syncNodeDateAndTime: typeof syncNodeDateAndTime
  getNodeNeighbors: typeof getNodeNeighbors
}

export type ConfirmRemove = (opts: {
  title: string
  message: string
  confirmText: string
  danger: true
}) => Promise<boolean>

export function refreshInfo(id: number): Promise<CallApiResult> {
  return controlRefreshInfo(id)
}

export function refreshValues(id: number): Promise<CallApiResult> {
  return controlRefreshValues(id)
}

export function pingNode(id: number): Promise<CallApiResult<boolean>> {
  return controlPingNode(id)
}

export function rebuildNodeRoutes(id: number): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('rebuildNodeRoutes', id)
}

export function isFailedNode(id: number): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('isFailedNode', id)
}

export function removeFailedNode(id: number): Promise<CallApiResult<void>> {
  return zwaveSocket.callApi('removeFailedNode', id)
}

export function syncNodeDateAndTime(id: number, date?: Date): Promise<CallApiResult<boolean>> {
  return date === undefined
    ? zwaveSocket.callApi('syncNodeDateAndTime', id)
    : zwaveSocket.callApi('syncNodeDateAndTime', id, date)
}

export function getNodeNeighbors(id: number): Promise<CallApiResult<readonly number[]>> {
  return zwaveSocket.callApi('getNodeNeighbors', id)
}

export function refreshNeighbors(): Promise<CallApiResult<Record<number, number[]>>> {
  return zwaveSocket.callApi('refreshNeighbors')
}

export const defaultMaintenanceApi: MaintenanceApi = {
  refreshInfo,
  refreshValues,
  pingNode,
  rebuildNodeRoutes,
  isFailedNode,
  removeFailedNode,
  syncNodeDateAndTime,
  getNodeNeighbors,
}

export function shouldOfferRemoveFailed(node: ZwaveNode): boolean {
  const status = deviceStatus(node)
  return node.failed === true || status === 'dead' || status === 'failed'
}

export function maintenanceActions(node: ZwaveNode): MaintenanceAction[] {
  const healthyEnough = !node.isControllerNode
  return [
    {
      id: 'refresh-info',
      label: 'Re-interview node',
      description: 'Re-run the node interview. This can take several minutes.',
      tier: 'advanced',
      enabled: healthyEnough,
      confirm: true,
    },
    {
      id: 'refresh-values',
      label: 'Refresh values',
      description: 'Ask the node to refresh all reported command-class values.',
      tier: 'advanced',
      enabled: healthyEnough,
    },
    {
      id: 'ping',
      label: 'Ping',
      description: 'Check whether the node responds to a Z-Wave ping.',
      tier: 'advanced',
      enabled: healthyEnough,
    },
    {
      id: 'rebuild-routes',
      label: 'Rebuild routes',
      description: 'Rebuild this node’s return routes through the mesh.',
      tier: 'advanced',
      enabled: healthyEnough,
    },
    {
      id: 'sync-time',
      label: 'Sync date/time',
      description: 'Set the node clock from the controller where supported.',
      tier: 'advanced',
      enabled: healthyEnough,
    },
    {
      id: 'get-neighbors',
      label: 'Get neighbors',
      description: 'Read this node’s current neighbor list from the controller.',
      tier: 'advanced',
      enabled: healthyEnough,
    },
    {
      id: 'remove-failed',
      label: 'Remove failed node',
      description: 'Remove a controller-marked failed node from the network.',
      tier: 'expert',
      enabled: healthyEnough && shouldOfferRemoveFailed(node),
      confirm: true,
      danger: true,
    },
  ]
}

export async function confirmRemoveFailed(
  api: Pick<MaintenanceApi, 'isFailedNode' | 'removeFailedNode'>,
  id: number,
  confirm: ConfirmRemove,
): Promise<CallApiResult<boolean | void>> {
  const failed = await api.isFailedNode(id)
  if (!failed.success) return failed
  if (failed.result !== true) {
    return { success: false, message: 'Node is not marked failed; removal was not attempted.', result: false }
  }

  const confirmed = await confirm({
    title: 'Remove failed node?',
    message: `Node ${id} is marked failed. Removing it is destructive and cannot be undone from this UI.`,
    confirmText: 'Remove failed node',
    danger: true,
  })
  if (!confirmed) return { success: true, message: 'Remove failed node cancelled', result: false }

  return api.removeFailedNode(id)
}

export function performMaintenanceAction(
  api: MaintenanceApi,
  id: number,
  action: MaintenanceActionId,
  confirm?: ConfirmRemove,
): Promise<CallApiResult> {
  switch (action) {
    case 'refresh-info':
      return api.refreshInfo(id)
    case 'refresh-values':
      return api.refreshValues(id)
    case 'ping':
      return api.pingNode(id)
    case 'rebuild-routes':
      return api.rebuildNodeRoutes(id)
    case 'sync-time':
      return api.syncNodeDateAndTime(id)
    case 'get-neighbors':
      return api.getNodeNeighbors(id)
    case 'remove-failed':
      if (!confirm) return Promise.resolve({ success: false, message: 'Confirmation is required.' })
      return confirmRemoveFailed(api, id, confirm)
  }
}

export function pushEvent(buffer: ActivityFeedItem[], item: ActivityFeedItem, max = 50): ActivityFeedItem[] {
  return [item, ...buffer].slice(0, max)
}

export function eventMatchesNode(payload: unknown, id: number): boolean {
  if (!isRecord(payload)) return false
  if (payload.nodeId === id) return true
  if (isRecord(payload.node) && payload.node.id === id) return true
  if (isRecord(payload.valueId) && payload.valueId.nodeId === id) return true
  if (payload.nodeId == null && payload.id === id && ('name' in payload || 'values' in payload)) return true
  return false
}

export function formatNodeEvent(payload: unknown): ActivityFeedItem {
  const time = eventTime(payload)

  if (isRecord(payload) && isRecord(payload.event)) {
    const label = humanize(String(payload.event.event ?? 'Node event'))
    return { time, label, detail: detailFromArgs(payload.event.args) }
  }

  if (
    isRecord(payload) &&
    'value' in payload &&
    ('commandClass' in payload || 'commandClassName' in payload || 'property' in payload || 'propertyName' in payload)
  ) {
    return { time, label: valueLabel(payload), detail: valueDetail(payload) }
  }

  if (Array.isArray(payload) && Array.isArray(payload[0])) {
    const [nodeId, status] = payload[0]
    return { time, label: 'Route rebuild', detail: `Node ${String(nodeId)}: ${String(status)}` }
  }

  if (isRecord(payload) && isRecord(payload.node)) {
    return { time, label: 'Node updated', detail: `Node ${String(payload.node.id ?? '')}`.trim() }
  }

  return { time, label: 'Activity', detail: stringifyUnknown(payload) }
}

function eventTime(payload: unknown): number {
  if (isRecord(payload)) {
    if (typeof payload.time === 'number') return payload.time
    if (typeof payload.time === 'string') return Date.parse(payload.time) || Date.now()
    if (isRecord(payload.event)) {
      const nested = payload.event.time
      if (typeof nested === 'number') return nested
      if (typeof nested === 'string') return Date.parse(nested) || Date.now()
      if (nested instanceof Date) return nested.getTime()
    }
  }
  return Date.now()
}

function valueLabel(value: Record<string, unknown>): string {
  const name = value.label || value.propertyName || value.property || 'Value'
  return `${String(name)} updated`
}

function valueDetail(value: Record<string, unknown>): string {
  const parts = [
    value.commandClassName ? String(value.commandClassName) : value.commandClass ? `CC ${String(value.commandClass)}` : '',
    'value' in value ? `value: ${stringifyUnknown(value.value)}` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

function detailFromArgs(args: unknown): string | undefined {
  if (!Array.isArray(args) || args.length === 0) return undefined
  return args.map(stringifyUnknown).join(' · ')
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
}

function stringifyUnknown(value: unknown): string {
  if (value == null) return String(value)
  if (value instanceof Date) return value.toLocaleString()
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

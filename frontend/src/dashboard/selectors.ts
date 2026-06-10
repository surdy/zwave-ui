import type { ConnectionStatus, ZwaveNode } from '@/api'
import {
  batteryInfo,
  deviceStatus,
  groupByRoom,
  needsAttention as nodeNeedsAttention,
  primaryControl,
} from '@/devices/model'

export interface DashboardRoom {
  location: string
  count: number
  devices: ZwaveNode[]
  controllableCount: number
}

export interface AttentionItem {
  node: ZwaveNode
  reasons: string[]
}

export interface ControllerSnapshot {
  status: ConnectionStatus
  controllerStatus: string | null
}

export interface NetworkSummary {
  totalDevices: number
  onlineCount: number
  controllerStatus: string
}

export function favoriteDevices(devices: ZwaveNode[], favoriteIds: number[]): ZwaveNode[] {
  const byId = new Map(devices.map((device) => [device.id, device]))
  return favoriteIds.map((id) => byId.get(id)).filter((device): device is ZwaveNode => Boolean(device))
}

export function roomSummaries(devices: ZwaveNode[]): DashboardRoom[] {
  return groupByRoom(devices).map((room) => ({
    location: room.location,
    count: room.devices.length,
    devices: room.devices,
    controllableCount: room.devices.filter((device) => primaryControl(device)).length,
  }))
}

export function hasPendingFirmwareUpdate(node: ZwaveNode): boolean {
  const explicit = node.firmwareUpdateAvailable ?? node.hasFirmwareUpdate ?? node.firmwareUpdatePending
  if (explicit === true) return true

  const version = node.newFirmwareVersion ?? node.availableFirmwareVersion ?? node.latestFirmwareVersion
  if (typeof version === 'string' && version.trim().length > 0 && version !== node.firmwareVersion) {
    return true
  }

  const update = node.firmwareUpdate
  if (typeof update === 'object' && update !== null) {
    const record = update as Record<string, unknown>
    if (record.available === true || record.pending === true) return true
    if (typeof record.version === 'string' && record.version.trim().length > 0) return true
  }

  return false
}

export function attentionItems(devices: ZwaveNode[]): AttentionItem[] {
  return devices
    .map((node) => {
      const reasons: string[] = []
      const status = deviceStatus(node)
      if (status === 'dead') reasons.push('Not responding')
      if (status === 'failed') reasons.push('Failed')
      const battery = batteryInfo(node)
      if (battery?.low) reasons.push(`Battery ${battery.level}%`)
      if (hasPendingFirmwareUpdate(node)) reasons.push('Firmware update')
      if (!nodeNeedsAttention(node) && reasons.length === 0) return null
      return { node, reasons }
    })
    .filter((item): item is AttentionItem => Boolean(item))
}

export function networkSummary(devices: ZwaveNode[], controller: ControllerSnapshot): NetworkSummary {
  return {
    totalDevices: devices.length,
    onlineCount: devices.filter((device) => {
      const status = deviceStatus(device)
      return status !== 'dead' && status !== 'failed'
    }).length,
    controllerStatus: controller.controllerStatus ?? controller.status,
  }
}

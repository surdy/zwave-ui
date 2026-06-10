export type DeviceTabTier = 'basic' | 'advanced' | 'expert'

export interface DeviceTab {
  id: string
  label: string
  tier: DeviceTabTier
}

export interface TabVisibilityOptions {
  advanced: boolean
}

export const DEVICE_DETAIL_TABS = [
  { id: 'overview', label: 'Overview', tier: 'basic' },
  { id: 'controls', label: 'Controls', tier: 'basic' },
  { id: 'configuration', label: 'Configuration', tier: 'advanced' },
  { id: 'associations', label: 'Associations', tier: 'advanced' },
  { id: 'firmware', label: 'Firmware', tier: 'expert' },
  { id: 'activity', label: 'Activity & maintenance', tier: 'advanced' },
] as const satisfies readonly DeviceTab[]

export type DeviceTabId = (typeof DEVICE_DETAIL_TABS)[number]['id']

export function visibleTabs<T extends DeviceTab>(tabs: readonly T[], opts: TabVisibilityOptions): T[] {
  return tabs.filter((tab) => tab.tier === 'basic' || opts.advanced)
}

export function isDeviceTabId(id: string): id is DeviceTabId {
  return DEVICE_DETAIL_TABS.some((tab) => tab.id === id)
}

import { describe, expect, it } from 'vitest'
import { DEVICE_DETAIL_TABS, visibleTabs, type DeviceTab } from '../tabs'

describe('visibleTabs', () => {
  it('shows only basic tabs when advanced mode is off', () => {
    expect(visibleTabs(DEVICE_DETAIL_TABS, { advanced: false }).map((t) => t.id)).toEqual(['overview', 'controls'])
  })

  it('shows advanced and expert tabs when advanced mode is on', () => {
    expect(visibleTabs(DEVICE_DETAIL_TABS, { advanced: true }).map((t) => t.id)).toEqual([
      'overview',
      'controls',
      'configuration',
      'associations',
      'firmware',
      'activity',
    ])
  })

  it('keeps expert tabs hidden with advanced tabs until advanced mode is enabled', () => {
    const matrix: DeviceTab[] = [
      { id: 'basic', label: 'Basic', tier: 'basic' },
      { id: 'advanced', label: 'Advanced', tier: 'advanced' },
      { id: 'expert', label: 'Expert', tier: 'expert' },
    ]
    expect(visibleTabs(matrix, { advanced: false }).map((t) => t.tier)).toEqual(['basic'])
    expect(visibleTabs(matrix, { advanced: true }).map((t) => t.tier)).toEqual(['basic', 'advanced', 'expert'])
  })
})

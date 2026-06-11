/**
 * Primary navigation model — the task-based areas from the information
 * architecture (docs/03-ux-design/information-architecture.md). Rendered as a
 * side rail on desktop and a bottom bar on mobile. Items flagged `advanced`
 * (e.g. Automations) only appear while Advanced mode is enabled.
 */
export interface NavItem {
  /** Route name. */
  name: string
  /** Route path. */
  to: string
  /** Visible label. */
  label: string
  /** BaseIcon name. */
  icon: string
  /** When true, the item is only shown while Advanced mode is enabled. */
  advanced?: boolean
}

export const primaryNav: NavItem[] = [
  { name: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { name: 'devices', to: '/devices', label: 'Devices', icon: 'devices' },
  { name: 'add', to: '/add', label: 'Add', icon: 'add' },
  { name: 'network', to: '/network', label: 'Network', icon: 'network' },
  { name: 'automations', to: '/automations', label: 'Automations', icon: 'automation', advanced: true },
  { name: 'settings', to: '/settings', label: 'Settings', icon: 'settings' },
]

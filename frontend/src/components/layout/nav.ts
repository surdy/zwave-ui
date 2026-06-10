/**
 * Primary navigation model — the 5 task-based areas from the information
 * architecture (docs/03-ux-design/information-architecture.md). Rendered as a
 * side rail on desktop and a bottom bar on mobile.
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
}

export const primaryNav: NavItem[] = [
  { name: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { name: 'devices', to: '/devices', label: 'Devices', icon: 'devices' },
  { name: 'add', to: '/add', label: 'Add', icon: 'add' },
  { name: 'network', to: '/network', label: 'Network', icon: 'network' },
  { name: 'settings', to: '/settings', label: 'Settings', icon: 'settings' },
]

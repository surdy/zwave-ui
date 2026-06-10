export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const preferenceKeys = {
  locale: 'zwui.locale',
  unit: 'zwui.unit',
  devicesView: 'zwui.devicesView',
  landingScreen: 'zwui.landingScreen',
} as const

export const locales = [{ value: 'en', label: 'English' }] as const
export const units = [
  { value: 'celsius', label: 'Celsius (°C)', symbol: '°C' },
  { value: 'fahrenheit', label: 'Fahrenheit (°F)', symbol: '°F' },
] as const
export const devicesViews = [
  { value: 'cards', label: 'Cards' },
  { value: 'table', label: 'Table' },
] as const
export const landingScreens = [
  { value: 'dashboard', label: 'Dashboard', routeName: 'dashboard' },
  { value: 'devices', label: 'Devices', routeName: 'devices' },
  { value: 'add', label: 'Add device', routeName: 'add' },
  { value: 'network', label: 'Network', routeName: 'network' },
  { value: 'settings-general', label: 'Settings', routeName: 'settings-general' },
] as const

export type LocalePreference = (typeof locales)[number]['value']
export type UnitPreference = (typeof units)[number]['value']
export type DevicesViewPreference = (typeof devicesViews)[number]['value']
export type LandingScreenPreference = (typeof landingScreens)[number]['value']
export type PreferenceKey = keyof typeof preferenceKeys

export interface AppPreferences {
  locale: LocalePreference
  unit: UnitPreference
  devicesView: DevicesViewPreference
  landingScreen: LandingScreenPreference
}

export const defaultPreferences: AppPreferences = {
  locale: 'en',
  unit: 'celsius',
  devicesView: 'cards',
  landingScreen: 'dashboard',
}

function isOneOf<T extends string>(value: string | null, options: readonly { value: T }[]): value is T {
  return value !== null && options.some((option) => option.value === value)
}

export function isValidLocale(value: string | null): value is LocalePreference {
  return isOneOf(value, locales)
}

export function isValidUnit(value: string | null): value is UnitPreference {
  return isOneOf(value, units)
}

export function isValidDevicesView(value: string | null): value is DevicesViewPreference {
  return isOneOf(value, devicesViews)
}

export function isValidLandingScreen(value: string | null): value is LandingScreenPreference {
  return isOneOf(value, landingScreens)
}

export function loadPreferences(storage: StorageLike): AppPreferences {
  const locale = storage.getItem(preferenceKeys.locale)
  const unit = storage.getItem(preferenceKeys.unit)
  const devicesView = storage.getItem(preferenceKeys.devicesView)
  const landingScreen = storage.getItem(preferenceKeys.landingScreen)

  return {
    locale: isValidLocale(locale) ? locale : defaultPreferences.locale,
    unit: isValidUnit(unit) ? unit : defaultPreferences.unit,
    devicesView: isValidDevicesView(devicesView) ? devicesView : defaultPreferences.devicesView,
    landingScreen: isValidLandingScreen(landingScreen)
      ? landingScreen
      : defaultPreferences.landingScreen,
  }
}

export function savePreference<K extends PreferenceKey>(
  storage: StorageLike,
  key: K,
  value: AppPreferences[K],
): void {
  storage.setItem(preferenceKeys[key], value)
}

export function localeLabel(value: LocalePreference): string {
  return locales.find((locale) => locale.value === value)?.label ?? value
}

export function unitSymbol(value: UnitPreference): string {
  return units.find((unit) => unit.value === value)?.symbol ?? ''
}

export function devicesViewLabel(value: DevicesViewPreference): string {
  return devicesViews.find((view) => view.value === value)?.label ?? value
}

export function landingRouteName(value: LandingScreenPreference): string {
  return landingScreens.find((screen) => screen.value === value)?.routeName ?? 'dashboard'
}

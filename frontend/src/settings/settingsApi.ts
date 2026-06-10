import { getJson, postJson, type RequestOptions } from '@/api/rest'

export interface ZwaveUiSettings {
  zwave?: Record<string, unknown>
  mqtt?: Record<string, unknown>
  gateway?: Record<string, unknown>
  homeAssistant?: Record<string, unknown>
  backup?: Record<string, unknown>
  system?: Record<string, unknown>
  ui?: Record<string, unknown>
  [key: string]: unknown
}

export interface SettingsResponse {
  settings?: ZwaveUiSettings
  [key: string]: unknown
}

export type SettingsPatch = Partial<ZwaveUiSettings>

export function getSettings(opts: RequestOptions = {}): Promise<SettingsResponse> {
  return getJson<SettingsResponse>('/api/settings', opts)
}

export function updateSettings(
  patch: SettingsPatch,
  opts: RequestOptions = {},
): Promise<SettingsResponse> {
  return postJson<SettingsResponse>('/api/settings', patch, opts)
}

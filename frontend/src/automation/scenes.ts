import { zwaveSocket } from '@/api/socket'
import type { CallApiResult, ValueId } from '@/api/types'

export type ZUIValueIdScene = ValueId & {
  timeout: number
  value?: unknown
}

export interface ZUIScene {
  sceneid: number
  label: string
  values: ZUIValueIdScene[]
}

export type SceneValueType = ValueId['type'] | 'list'

export function getScenes(): Promise<CallApiResult<ZUIScene[]>> {
  return zwaveSocket.callApi<ZUIScene[]>('_getScenes')
}

export function createScene(label: string): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('_createScene', label)
}

export function removeScene(sceneid: number): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('_removeScene', sceneid)
}

export function setScenes(scenes: ZUIScene[]): Promise<CallApiResult<ZUIScene[]>> {
  return zwaveSocket.callApi<ZUIScene[]>('_setScenes', scenes)
}

export function sceneGetValues(sceneid: number): Promise<CallApiResult<ZUIValueIdScene[]>> {
  return zwaveSocket.callApi<ZUIValueIdScene[]>('_sceneGetValues', sceneid)
}

export function addSceneValue(
  sceneid: number,
  valueId: ZUIValueIdScene,
  value: unknown,
  timeout: number,
): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('_addSceneValue', sceneid, valueId, value, timeout)
}

export function removeSceneValue(sceneid: number, valueId: ZUIValueIdScene): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('_removeSceneValue', sceneid, valueId)
}

export function activateScene(sceneid: number): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi<boolean>('_activateScene', sceneid)
}

export function sceneValueCount(scene: Pick<ZUIScene, 'values'>): number {
  return scene.values?.length ?? 0
}

export function isValidSceneLabel(label: string): boolean {
  return label.trim().length > 0 && label.trim().length <= 80
}

export function nextSceneLabel(scenes: Pick<ZUIScene, 'label'>[]): string {
  const labels = new Set(scenes.map((scene) => scene.label.trim()))
  let index = scenes.length + 1
  let label = `Scene ${index}`
  while (labels.has(label)) {
    index += 1
    label = `Scene ${index}`
  }
  return label
}

export function isWriteableValue(meta?: Pick<ValueId, 'writeable' | 'stateless'> | null): boolean {
  return meta?.writeable === true && meta.stateless !== true
}

export function coerceSceneValue(raw: unknown, valueType: SceneValueType): unknown {
  if (valueType === 'boolean') {
    if (typeof raw === 'boolean') return raw
    const value = String(raw).trim().toLowerCase()
    return value === 'true' || value === '1' || value === 'on' || value === 'yes'
  }
  if (valueType === 'number' || valueType === 'duration') {
    const value = Number(raw)
    return Number.isFinite(value) ? value : 0
  }
  if (valueType === 'string[]' || valueType === 'number[]') {
    return Array.isArray(raw) ? raw : String(raw).split(',').map((item) => item.trim()).filter(Boolean)
  }
  return raw
}

export function formatSceneValue(
  valueId: Pick<ZUIValueIdScene, 'label' | 'propertyName' | 'property' | 'propertyKeyName' | 'value' | 'timeout'>,
  metadata?: Pick<ValueId, 'states' | 'type' | 'unit'> | null,
): string {
  const name = [valueId.label || valueId.propertyName || String(valueId.property), valueId.propertyKeyName]
    .filter(Boolean)
    .join(' · ')
  const target = formatTargetValue(valueId.value, metadata)
  const delay = valueId.timeout > 0 ? ` after ${valueId.timeout}s` : ''
  return `${name}: ${target}${delay}`
}

function formatTargetValue(value: unknown, metadata?: Pick<ValueId, 'states' | 'type' | 'unit'> | null): string {
  const state = metadata?.states?.find((item) => String(item.value) === String(value))
  if (state) return state.text
  if (metadata?.type === 'boolean' || typeof value === 'boolean') return value ? 'On' : 'Off'
  if (value === undefined || value === null || value === '') return '—'
  return `${String(value)}${metadata?.unit ?? ''}`
}

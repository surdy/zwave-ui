import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ValueId } from '@/api/types'

const { callApi } = vi.hoisted(() => ({ callApi: vi.fn() }))

vi.mock('@/api/socket', () => ({
  zwaveSocket: { callApi },
}))

import {
  activateScene,
  addSceneValue,
  coerceSceneValue,
  createScene,
  formatSceneValue,
  getScenes,
  isValidSceneLabel,
  isWriteableValue,
  nextSceneLabel,
  removeScene,
  removeSceneValue,
  sceneGetValues,
  sceneValueCount,
  setScenes,
  type ZUIScene,
  type ZUIValueIdScene,
} from '../scenes'

const valueId: ZUIValueIdScene = {
  id: '2-37-0-targetValue',
  nodeId: 2,
  commandClass: 37,
  endpoint: 0,
  property: 'targetValue',
  type: 'boolean',
  readable: true,
  writeable: true,
  label: 'Switch',
  timeout: 5,
  value: true,
}

const scene: ZUIScene = { sceneid: 1, label: 'Evening', values: [valueId] }

describe('scene API wrappers', () => {
  beforeEach(() => {
    callApi.mockReset()
    callApi.mockResolvedValue({ success: true, message: 'ok' })
  })

  it('calls backend scene APIs with expected names and arguments', async () => {
    await getScenes()
    await createScene('Evening')
    await removeScene(1)
    await setScenes([scene])
    await sceneGetValues(1)
    await addSceneValue(1, valueId, true, 5)
    await removeSceneValue(1, valueId)
    await activateScene(1)

    expect(callApi).toHaveBeenNthCalledWith(1, '_getScenes')
    expect(callApi).toHaveBeenNthCalledWith(2, '_createScene', 'Evening')
    expect(callApi).toHaveBeenNthCalledWith(3, '_removeScene', 1)
    expect(callApi).toHaveBeenNthCalledWith(4, '_setScenes', [scene])
    expect(callApi).toHaveBeenNthCalledWith(5, '_sceneGetValues', 1)
    expect(callApi).toHaveBeenNthCalledWith(6, '_addSceneValue', 1, valueId, true, 5)
    expect(callApi).toHaveBeenNthCalledWith(7, '_removeSceneValue', 1, valueId)
    expect(callApi).toHaveBeenNthCalledWith(8, '_activateScene', 1)
  })
})

describe('scene value helpers', () => {
  it('counts scene values safely', () => {
    expect(sceneValueCount(scene)).toBe(1)
  })

  it('formats boolean, number, and list target values', () => {
    expect(formatSceneValue(valueId, { type: 'boolean' })).toBe('Switch: On after 5s')
    expect(formatSceneValue({ ...valueId, label: 'Level', value: 42, timeout: 0 }, { type: 'number', unit: '%' })).toBe('Level: 42%')
    expect(formatSceneValue({ ...valueId, label: 'Mode', value: 1, timeout: 0 }, { type: 'number', states: [{ text: 'Heat', value: 1 }] })).toBe('Mode: Heat')
  })

  it('coerces raw input to backend value types', () => {
    expect(coerceSceneValue('true', 'boolean')).toBe(true)
    expect(coerceSceneValue('off', 'boolean')).toBe(false)
    expect(coerceSceneValue('12.5', 'number')).toBe(12.5)
    expect(coerceSceneValue('heat', 'list')).toBe('heat')
  })

  it('detects writeable values', () => {
    expect(isWriteableValue({ writeable: true, stateless: false } as ValueId)).toBe(true)
    expect(isWriteableValue({ writeable: true, stateless: true } as ValueId)).toBe(false)
    expect(isWriteableValue({ writeable: false, stateless: false } as ValueId)).toBe(false)
  })
})

describe('scene labels', () => {
  it('validates labels', () => {
    expect(isValidSceneLabel('Evening')).toBe(true)
    expect(isValidSceneLabel('   ')).toBe(false)
    expect(isValidSceneLabel('x'.repeat(81))).toBe(false)
  })

  it('suggests the next available label', () => {
    expect(nextSceneLabel([{ label: 'Scene 1' }, { label: 'Scene 2' }])).toBe('Scene 3')
    expect(nextSceneLabel([{ label: 'Scene 2' }])).toBe('Scene 3')
  })
})

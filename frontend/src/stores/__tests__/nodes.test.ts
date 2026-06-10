import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNodesStore } from '../nodes'
import type { ValueId, ZwaveNode } from '@/api'

function node(id: number, extra: Partial<ZwaveNode> = {}): ZwaveNode {
  return {
    id,
    ready: true,
    available: true,
    failed: false,
    inited: true,
    ...extra,
  }
}

describe('nodes store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('hydrates from a node array and sorts by id', () => {
    const store = useNodesStore()
    store.setAll([node(3), node(1), node(2)])
    expect(store.count).toBe(3)
    expect(store.list.map((n) => n.id)).toEqual([1, 2, 3])
  })

  it('separates the controller node from devices', () => {
    const store = useNodesStore()
    store.setAll([node(1, { isControllerNode: true }), node(2), node(3)])
    expect(store.controllerNode?.id).toBe(1)
    expect(store.devices.map((n) => n.id)).toEqual([2, 3])
  })

  it('merges partial NODE_UPDATED patches without dropping values', () => {
    const store = useNodesStore()
    store.setAll([node(5, { name: 'Lamp', values: { a: { id: 'a' } as ValueId } })])
    store.upsertNode({ id: 5, status: 'Awake' }, true)
    const n = store.getNode(5)
    expect(n.name).toBe('Lamp') // preserved
    expect(n.status).toBe('Awake') // patched
    expect(n.values?.a).toBeTruthy() // values preserved
  })

  it('replaces the node on a full (non-partial) update', () => {
    const store = useNodesStore()
    store.setAll([node(5, { name: 'Old' })])
    store.upsertNode(node(5, { name: 'New' }))
    expect(store.getNode(5).name).toBe('New')
  })

  it('applies VALUE_UPDATED into the owning node', () => {
    const store = useNodesStore()
    store.setAll([node(7)])
    const value: ValueId = {
      id: '37-0-currentValue',
      nodeId: 7,
      commandClass: 37,
      property: 'currentValue',
      type: 'boolean',
      readable: true,
      writeable: false,
      value: true,
    }
    store.updateValue(value)
    expect(store.getNode(7).values?.['37-0-currentValue']?.value).toBe(true)
  })

  it('removes a value on VALUE_REMOVED', () => {
    const store = useNodesStore()
    store.setAll([node(7, { values: { x: { id: 'x', nodeId: 7 } as ValueId } })])
    store.removeValue({ nodeId: 7, id: 'x' })
    expect(store.getNode(7).values?.x).toBeUndefined()
  })

  it('removes a node on NODE_REMOVED', () => {
    const store = useNodesStore()
    store.setAll([node(1), node(2)])
    store.removeNode(1)
    expect(store.getNode(1)).toBeUndefined()
    expect(store.count).toBe(1)
  })

  it('ignores value updates for unknown nodes', () => {
    const store = useNodesStore()
    store.updateValue({ id: 'z', nodeId: 99 } as ValueId)
    expect(store.count).toBe(0)
  })
})

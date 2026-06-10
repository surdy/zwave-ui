import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NodeGroup, ZwaveNode } from '@/api'

const { callApi } = vi.hoisted(() => ({ callApi: vi.fn() }))

vi.mock('@/api', () => ({
  zwaveSocket: { callApi },
}))
import {
  addAssociations,
  associationGroups,
  availableTargets,
  canAddToGroup,
  checkAssociation,
  getAssociations,
  removeAllAssociations,
  removeAssociations,
  resolveMemberName,
  sourceForGroup,
  type AssociationAddress,
  type AssociationGroup,
} from '../associations'

function node(p: Partial<ZwaveNode> & { id: number }): ZwaveNode {
  return {
    ready: true,
    available: true,
    failed: false,
    inited: true,
    ...p,
  } as ZwaveNode
}

function group(p: Partial<NodeGroup> & { value: number }): NodeGroup {
  return {
    title: `Group ${p.value}`,
    endpoint: 0,
    maxNodes: 5,
    isLifeline: false,
    multiChannel: false,
    ...p,
  }
}

function address(nodeId: number, endpoint?: number): AssociationAddress {
  return endpoint ? { nodeId, endpoint } : { nodeId }
}

describe('association API wrappers', () => {
  beforeEach(() => {
    callApi.mockReset()
    callApi.mockResolvedValue({ success: true })
  })

  it('calls getAssociations with the node id', async () => {
    await getAssociations(2)
    expect(callApi).toHaveBeenCalledWith('getAssociations', 2)
  })

  it('checks then adds associations with source, group id and target array', async () => {
    const source = { nodeId: 2, endpoint: 1 }
    const target = { nodeId: 3, endpoint: 2 }

    await checkAssociation(source, 4, target)
    await addAssociations(source, 4, [target])

    expect(callApi).toHaveBeenNthCalledWith(1, 'checkAssociation', source, 4, target)
    expect(callApi).toHaveBeenNthCalledWith(2, 'addAssociations', source, 4, [target])
  })

  it('removes associations with source, group id and target array', async () => {
    const source = { nodeId: 2, endpoint: 0 }
    const target = { nodeId: 5 }

    await removeAssociations(source, 1, [target])

    expect(callApi).toHaveBeenCalledWith('removeAssociations', source, 1, [target])
  })

  it('removes all associations with the upstream node-id signature', async () => {
    await removeAllAssociations({ nodeId: 7, endpoint: 2 })

    expect(callApi).toHaveBeenCalledWith('removeAllAssociations', 7)
  })
})

describe('associationGroups', () => {
  it('normalizes node groups, lifeline metadata and current members', () => {
    const source = node({
      id: 2,
      groups: [
        group({ value: 1, title: 'Lifeline', isLifeline: true, maxNodes: 1 }),
        group({ value: 2, title: 'Switches', endpoint: 1, multiChannel: true, maxNodes: 3 }),
      ],
    })

    const groups = associationGroups(source, [
      { endpoint: 0, groupId: 1, nodeId: 1 },
      { endpoint: 1, groupId: 2, nodeId: 3, targetEndpoint: 2 },
      { endpoint: 2, groupId: 2, nodeId: 4 },
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ id: 1, title: 'Lifeline', isLifeline: true, endpoint: 0 })
    expect(groups[0].members).toEqual([{ nodeId: 1 }])
    expect(groups[1]).toMatchObject({ id: 2, title: 'Switches', multiChannel: true, endpoint: 1 })
    expect(groups[1].members).toEqual([{ nodeId: 3, endpoint: 2 }])
  })

  it('builds the source address for a group', () => {
    const source = node({ id: 9 })
    const [assocGroup] = associationGroups(source, [],)
    expect(sourceForGroup(source, assocGroup ?? ({ endpoint: 0 } as AssociationGroup))).toEqual({ nodeId: 9, endpoint: 0 })
  })
})

describe('association pure helpers', () => {
  it('resolves member names with endpoint labels and node fallback', () => {
    const nodes = [node({ id: 2, name: 'Kitchen Light' }), node({ id: 3, productLabel: 'Dimmer' })]

    expect(resolveMemberName(nodes, address(2, 1))).toBe('Kitchen Light · endpoint 1')
    expect(resolveMemberName(nodes, address(3))).toBe('Dimmer')
    expect(resolveMemberName(nodes, address(9))).toBe('Node 9')
  })

  it('filters available targets by self, duplicates and full groups', () => {
    const source = node({ id: 2, name: 'Source' })
    const targets = [source, node({ id: 3 }), node({ id: 4 }), node({ id: 5 })]
    const assocGroup: AssociationGroup = {
      id: 2,
      title: 'Basic set',
      endpoint: 0,
      maxNodes: 3,
      isLifeline: false,
      multiChannel: false,
      members: [address(3)],
    }

    expect(availableTargets(targets, source, assocGroup).map((target) => target.id)).toEqual([4, 5])
    expect(canAddToGroup(assocGroup, 2)).toBe(true)
    expect(canAddToGroup(assocGroup, 3)).toBe(false)
    expect(availableTargets(targets, source, { ...assocGroup, maxNodes: 1 })).toEqual([])
  })
})

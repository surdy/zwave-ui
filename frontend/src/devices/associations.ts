import { zwaveSocket, type CallApiResult, type NodeGroup, type ZwaveNode } from '@/api'
import { deviceName } from '@/devices/model'

export interface AssociationAddress {
  nodeId: number
  endpoint?: number
}

export interface GroupAssociation {
  endpoint?: number
  groupId: number
  nodeId: number
  targetEndpoint?: number
}

export interface AssociationGroup {
  id: number
  title: string
  endpoint: number
  maxNodes: number
  isLifeline: boolean
  multiChannel: boolean
  members: AssociationAddress[]
}

export function getAssociations(nodeId: number): Promise<CallApiResult<GroupAssociation[]>> {
  return zwaveSocket.callApi('getAssociations', nodeId)
}

export function checkAssociation(
  source: AssociationAddress,
  groupId: number,
  target: AssociationAddress,
): Promise<CallApiResult> {
  return zwaveSocket.callApi('checkAssociation', source, groupId, target)
}

export function addAssociations(
  source: AssociationAddress,
  groupId: number,
  targets: AssociationAddress[],
): Promise<CallApiResult> {
  return zwaveSocket.callApi('addAssociations', source, groupId, targets)
}

export function removeAssociations(
  source: AssociationAddress,
  groupId: number,
  targets: AssociationAddress[],
): Promise<CallApiResult> {
  return zwaveSocket.callApi('removeAssociations', source, groupId, targets)
}

export function removeAllAssociations(source: AssociationAddress): Promise<CallApiResult> {
  return zwaveSocket.callApi('removeAllAssociations', source.nodeId)
}

export function sourceForGroup(node: ZwaveNode, group: Pick<AssociationGroup, 'endpoint'>): AssociationAddress {
  return { nodeId: node.id, endpoint: group.endpoint }
}

export function associationGroups(
  node: ZwaveNode,
  associations: GroupAssociation[] = [],
): AssociationGroup[] {
  const groups = (node.groups ?? []).map((group) => normalizeGroup(group))

  for (const group of groups) {
    group.members = associations
      .filter((member) => member.groupId === group.id && (member.endpoint ?? 0) === group.endpoint)
      .map((member) => normalizeAddress({ nodeId: member.nodeId, endpoint: member.targetEndpoint }))
  }

  return groups.sort((a, b) => a.endpoint - b.endpoint || a.id - b.id)
}

export function resolveMemberName(nodes: readonly ZwaveNode[], address: AssociationAddress): string {
  const node = nodes.find((candidate) => candidate.id === address.nodeId)
  const name = node ? deviceName(node) : `Node ${address.nodeId}`
  return address.endpoint ? `${name} · endpoint ${address.endpoint}` : name
}

export function availableTargets(
  allNodes: readonly ZwaveNode[],
  node: ZwaveNode,
  group: Pick<AssociationGroup, 'maxNodes' | 'members'>,
): ZwaveNode[] {
  if (!canAddToGroup(group, group.members.length)) return []
  const associated = new Set(group.members.map((member) => member.nodeId))
  return allNodes
    .filter((candidate) => candidate.id !== node.id)
    .filter((candidate) => !associated.has(candidate.id))
    .sort((a, b) => a.id - b.id)
}

export function canAddToGroup(
  group: Pick<AssociationGroup, 'maxNodes'>,
  currentCount: number,
): boolean {
  return group.maxNodes > currentCount
}

function normalizeGroup(group: NodeGroup): AssociationGroup {
  return {
    id: Number(group.value),
    title: group.title || `Group ${group.value}`,
    endpoint: Number(group.endpoint ?? 0),
    maxNodes: Number(group.maxNodes ?? 0),
    isLifeline: Boolean(group.isLifeline),
    multiChannel: Boolean(group.multiChannel),
    members: [],
  }
}

function normalizeAddress(address: AssociationAddress): AssociationAddress {
  const endpoint = Number(address.endpoint ?? 0)
  return endpoint > 0 ? { nodeId: Number(address.nodeId), endpoint } : { nodeId: Number(address.nodeId) }
}

/**
 * Nodes store: the authoritative client-side mirror of the network's nodes.
 *
 * Hydrated from the INITED handshake (`setAll`) and kept live by socket events:
 *   - NODE_ADDED / NODE_UPDATED -> upsertNode (NODE_UPDATED may be partial)
 *   - NODE_REMOVED              -> removeNode
 *   - VALUE_UPDATED             -> updateValue
 *   - VALUE_REMOVED             -> removeValue
 */
import { defineStore } from 'pinia'
import type { ValueId, ZwaveNode } from '@/api'

interface NodesState {
  byId: Record<number, ZwaveNode>
}

export const useNodesStore = defineStore('nodes', {
  state: (): NodesState => ({
    byId: {},
  }),
  getters: {
    list: (s): ZwaveNode[] => Object.values(s.byId).sort((a, b) => a.id - b.id),
    count(): number {
      return this.list.length
    },
    /** The controller's own node, if present. */
    controllerNode: (s): ZwaveNode | undefined =>
      Object.values(s.byId).find((n) => n.isControllerNode),
    /** Real devices (everything that isn't the controller). */
    devices(): ZwaveNode[] {
      return this.list.filter((n) => !n.isControllerNode)
    },
    getNode: (s) => (id: number) => s.byId[id],
  },
  actions: {
    setAll(nodes: ZwaveNode[]) {
      const next: Record<number, ZwaveNode> = {}
      for (const node of nodes) next[node.id] = node
      this.byId = next
    },
    upsertNode(node: Partial<ZwaveNode> & { id: number }, isPartial = false) {
      const existing = this.byId[node.id]
      if (isPartial && existing) {
        const { values: patchValues, ...rest } = node
        Object.assign(existing, rest)
        if (patchValues) existing.values = { ...existing.values, ...patchValues }
      } else {
        this.byId[node.id] = node as ZwaveNode
      }
    },
    removeNode(id: number) {
      delete this.byId[id]
    },
    updateValue(value: ValueId) {
      const node = this.byId[value.nodeId]
      if (!node) return
      if (!node.values) node.values = {}
      node.values[value.id] = { ...node.values[value.id], ...value }
    },
    removeValue(value: Pick<ValueId, 'nodeId' | 'id'>) {
      const node = this.byId[value.nodeId]
      if (node?.values) delete node.values[value.id]
    },
    reset() {
      this.byId = {}
    },
  },
})

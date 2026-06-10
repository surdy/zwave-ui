/**
 * Bootstraps the realtime connection and wires backend socket events into the
 * Pinia stores. Call `connect()` once from the app shell after Pinia is ready.
 */
import {
  authenticateWithToken,
  fetchAuthEnabled,
  getStoredToken,
  isTokenValid,
  setStoredToken,
  SocketEvent,
  zwaveSocket,
  type ControllerInfo,
  type ControllerStatusPayload,
  type ValueId,
  type ZwaveNode,
  type ZwaveState,
} from '@/api'
import { useControllerStore } from '@/stores/controller'
import { useNodesStore } from '@/stores/nodes'

let wired = false
let connectCount = 0

export function useZwaveConnection() {
  const controller = useControllerStore()
  const nodes = useNodesStore()

  function hydrate(state: ZwaveState) {
    if (Array.isArray(state?.nodes)) nodes.setAll(state.nodes)
    if (state?.info) controller.setInfo(state.info)
    if (state?.cntStatus) controller.applyControllerCmd({ status: state.cntStatus })
    if (state?.inclusionState) controller.applyControllerCmd({ inclusionState: state.inclusionState })
  }

  function wireListeners() {
    if (wired) return
    wired = true

    zwaveSocket.on(SocketEvent.valueUpdated, (v) => nodes.updateValue(v as ValueId))
    zwaveSocket.on(SocketEvent.valueRemoved, (v) => nodes.removeValue(v as ValueId))
    zwaveSocket.on(SocketEvent.metadataUpdated, (v) => nodes.updateValue(v as ValueId))
    zwaveSocket.on(SocketEvent.nodeUpdated, (node, isPartial) =>
      nodes.upsertNode(node as ZwaveNode, Boolean(isPartial)),
    )
    zwaveSocket.on(SocketEvent.nodeAdded, (payload) => {
      const node = (payload as { node?: ZwaveNode })?.node
      if (node) nodes.upsertNode(node)
    })
    zwaveSocket.on(SocketEvent.nodeRemoved, (node) => {
      const id = (node as ZwaveNode)?.id
      if (typeof id === 'number') nodes.removeNode(id)
    })
    zwaveSocket.on(SocketEvent.controller, (p) =>
      controller.applyControllerCmd(p as ControllerStatusPayload),
    )
    zwaveSocket.on(SocketEvent.info, (info) => controller.setInfo(info as ControllerInfo))
    zwaveSocket.on(SocketEvent.connected, (info) => controller.setInfo(info as ControllerInfo))
    zwaveSocket.on(SocketEvent.init, (state) => hydrate(state as ZwaveState))

    zwaveSocket.on('connect', () => {
      controller.setStatus('connected')
      // Re-hydrate after a reconnect (the first connect is handled by connect()).
      if (connectCount > 0) zwaveSocket.fetchState().then(hydrate)
      connectCount += 1
    })
    zwaveSocket.on('disconnect', () => controller.setStatus('reconnecting'))
    zwaveSocket.on('connect_error', () => controller.setStatus('error'))
  }

  /**
   * Resolve auth, open the socket, wire stores, and hydrate from INITED.
   * Returns the initial state, or null if a login is required.
   */
  async function connect(): Promise<ZwaveState | null> {
    controller.setStatus('connecting')

    let token: string | null = null
    try {
      const authEnabled = await fetchAuthEnabled()
      if (authEnabled) {
        token = getStoredToken()
        if (!isTokenValid(token)) {
          // Try to refresh the session from a (possibly server-side) token.
          if (token) {
            const res = await authenticateWithToken(token)
            token = res.success ? (res.user?.token ?? null) : null
          }
          if (!isTokenValid(token)) {
            setStoredToken(null)
            controller.setStatus('disconnected')
            return null // caller should route to /login
          }
        }
      }
    } catch {
      // auth-enabled probe failed; proceed unauthenticated and let the socket
      // surface a connect_error if the instance actually requires auth.
      token = null
    }

    const statePromise = zwaveSocket.connect({ token })
    wireListeners()
    try {
      const state = await statePromise
      hydrate(state)
      controller.setStatus('connected')
      return state
    } catch (err) {
      controller.setStatus('error')
      controller.setError(err instanceof Error ? err.message : 'connection failed')
      throw err
    }
  }

  function disconnect() {
    zwaveSocket.disconnect()
    wired = false
    connectCount = 0
    controller.setStatus('disconnected')
  }

  return { connect, disconnect }
}

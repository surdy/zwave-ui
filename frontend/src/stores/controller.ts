/**
 * Controller / connection store: app + driver info, controller status, and the
 * realtime connection lifecycle surfaced to the UI.
 */
import { defineStore } from 'pinia'
import type { ConnectionStatus, ControllerInfo, ControllerStatusPayload } from '@/api'

interface ControllerState {
  status: ConnectionStatus
  info: ControllerInfo | null
  controllerStatus: string | null
  inclusionState: string | null
  error: string | null
}

export const useControllerStore = defineStore('controller', {
  state: (): ControllerState => ({
    status: 'idle',
    info: null,
    controllerStatus: null,
    inclusionState: null,
    error: null,
  }),
  getters: {
    isConnected: (s) => s.status === 'connected',
    isDriverReady: (s) => Boolean(s.info?.status) && s.status === 'connected',
    homeName: (s) => s.info?.name ?? null,
    appVersion: (s) => s.info?.appVersion ?? null,
  },
  actions: {
    setStatus(status: ConnectionStatus) {
      this.status = status
    },
    setInfo(info: ControllerInfo) {
      this.info = { ...this.info, ...info }
      if (info.cntStatus) this.controllerStatus = info.cntStatus
      if (info.inclusionState) this.inclusionState = info.inclusionState
    },
    applyControllerCmd(payload: ControllerStatusPayload) {
      if (payload.status !== undefined) this.controllerStatus = payload.status
      if (payload.inclusionState !== undefined) this.inclusionState = payload.inclusionState
      this.error = payload.error ?? null
    },
    setError(error: string | null) {
      this.error = error
    },
    reset() {
      this.$reset()
    },
  },
})

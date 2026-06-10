/**
 * Socket.IO client wrapper.
 *
 * Owns the realtime connection to the zwave-js-ui backend and exposes a small,
 * typed surface: connect/disconnect, the INITED handshake, channel
 * subscriptions, event listeners, and `callApi` (the ZWAVE_API request/ack
 * round-trip). Store wiring lives in composables/useZwaveConnection.ts.
 */
import { io, type Socket } from 'socket.io-client'
import {
  CORE_CHANNELS,
  InboundEvent,
  type ChannelName,
  type SocketEventName,
} from './events'
import type { CallApiResult, ZwaveState } from './types'

export interface ConnectOptions {
  /** JWT for authenticated instances; omit when auth is disabled. */
  token?: string | null
  /** Channels to join on connect. Defaults to the core dashboard channels. */
  channels?: ChannelName[]
}

type Listener = (...args: unknown[]) => void

const SOCKET_PATH = '/socket.io'

export class ZwaveSocket {
  private socket: Socket | null = null
  private channels: ChannelName[] = CORE_CHANNELS
  private queued: { api: string; args: unknown[]; resolve: (r: CallApiResult) => void }[] = []

  get connected(): boolean {
    return this.socket?.connected ?? false
  }

  /** Raw socket, for advanced/per-feature wiring. */
  get raw(): Socket | null {
    return this.socket
  }

  /**
   * Open the connection. Resolves with the INITED state once the handshake
   * completes. Safe to call once; call `disconnect()` before reconnecting with
   * different credentials.
   */
  connect(opts: ConnectOptions = {}): Promise<ZwaveState> {
    if (this.socket) this.disconnect()
    if (opts.channels) this.channels = opts.channels

    const auth = opts.token ? { token: opts.token } : undefined
    this.socket = io({ path: SOCKET_PATH, auth, rejectUnauthorized: false })

    return new Promise((resolve, reject) => {
      let settled = false
      const sock = this.socket as Socket

      sock.on('connect', () => {
        this.subscribe(this.channels)
        sock.emit(InboundEvent.init, true, (state: ZwaveState) => {
          this.flushQueue()
          if (!settled) {
            settled = true
            resolve(state)
          }
        })
      })

      sock.on('connect_error', (err: Error) => {
        if (!settled) {
          settled = true
          reject(err)
        }
      })
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    this.queued = []
  }

  /** Re-fetch the full backend state via the INITED handshake. */
  fetchState(): Promise<ZwaveState> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('socket not connected'))
      this.socket.emit(InboundEvent.init, true, (state: ZwaveState) => resolve(state))
    })
  }

  subscribe(channels: ChannelName[]): void {
    if (!this.socket || channels.length === 0) return
    this.socket.emit(InboundEvent.subscribe, { channels })
  }

  unsubscribe(channels: ChannelName[]): void {
    if (!this.socket || channels.length === 0) return
    this.socket.emit(InboundEvent.unsubscribe, { channels })
  }

  on(event: SocketEventName | 'connect' | 'disconnect' | 'connect_error', cb: Listener): void {
    this.socket?.on(event, cb)
  }

  off(event: SocketEventName | 'connect' | 'disconnect' | 'connect_error', cb?: Listener): void {
    this.socket?.off(event, cb)
  }

  /**
   * Call a ZWAVE_API method. Resolves with the result envelope. If the socket
   * is not yet connected, the call is queued and flushed after the handshake.
   */
  callApi<T = unknown>(api: string, ...args: unknown[]): Promise<CallApiResult<T>> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        this.queued.push({ api, args, resolve: resolve as (r: CallApiResult) => void })
        return
      }
      this.emitApi(api, args, resolve as (r: CallApiResult) => void)
    })
  }

  private emitApi(api: string, args: unknown[], resolve: (r: CallApiResult) => void): void {
    this.socket?.emit(InboundEvent.zwave, { api, args }, (response: CallApiResult) => {
      resolve(response)
    })
  }

  private flushQueue(): void {
    const pending = this.queued
    this.queued = []
    for (const item of pending) this.emitApi(item.api, item.args, item.resolve)
  }
}

/** Shared singleton used across the app. */
export const zwaveSocket = new ZwaveSocket()

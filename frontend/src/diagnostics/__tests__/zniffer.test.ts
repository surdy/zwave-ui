import { describe, expect, it, vi, beforeEach } from 'vitest'
import { InboundEvent } from '@/api/events'
import { zwaveSocket } from '@/api/socket'
import {
  appendFrames,
  computeWindow,
  filterFrames,
  loadCaptureFromBuffer,
  parseFrequencyOptions,
  payloadToHex,
  saveCapture,
  setFrequency,
  setLRChannelConfig,
  znifferClear,
  znifferGetFrames,
  znifferStart,
  znifferStop,
  type ZnifferFrame,
} from '@/diagnostics/zniffer'

vi.mock('@/api/socket', () => ({
  zwaveSocket: {
    connected: true,
    raw: {
      emit: vi.fn((_event: string, _payload: unknown, cb: (response: unknown) => void) => cb({ success: true, message: 'ok' })),
    },
  },
}))

const emit = vi.mocked(zwaveSocket.raw?.emit)

describe('zniffer API helpers', () => {
  beforeEach(() => {
    emit?.mockClear()
    Object.defineProperty(zwaveSocket, 'connected', { value: true, configurable: true })
  })

  it('emits typed ZNIFFER_API helpers', async () => {
    await znifferStart()
    await znifferStop()
    await znifferClear()
    await znifferGetFrames()
    await setFrequency(3)
    await setLRChannelConfig(2)
    await saveCapture()
    await loadCaptureFromBuffer([1, 2, 3])

    expect(emit).toHaveBeenNthCalledWith(1, InboundEvent.zniffer, { apiName: 'start' }, expect.any(Function))
    expect(emit).toHaveBeenNthCalledWith(2, InboundEvent.zniffer, { apiName: 'stop' }, expect.any(Function))
    expect(emit).toHaveBeenNthCalledWith(3, InboundEvent.zniffer, { apiName: 'clear' }, expect.any(Function))
    expect(emit).toHaveBeenNthCalledWith(4, InboundEvent.zniffer, { apiName: 'getFrames' }, expect.any(Function))
    expect(emit).toHaveBeenNthCalledWith(5, InboundEvent.zniffer, { apiName: 'setFrequency', frequency: 3 }, expect.any(Function))
    expect(emit).toHaveBeenNthCalledWith(6, InboundEvent.zniffer, { apiName: 'setLRChannelConfig', channelConfig: 2 }, expect.any(Function))
    expect(emit).toHaveBeenNthCalledWith(7, InboundEvent.zniffer, { apiName: 'saveCaptureToFile' }, expect.any(Function))
    expect(emit).toHaveBeenNthCalledWith(8, InboundEvent.zniffer, { apiName: 'loadCaptureFromBuffer', buffer: [1, 2, 3] }, expect.any(Function))
  })

  it('returns a failed response when the socket is disconnected', async () => {
    Object.defineProperty(zwaveSocket, 'connected', { value: false, configurable: true })
    await expect(znifferStart()).resolves.toEqual({ success: false, message: 'Socket not connected' })
    expect(emit).not.toHaveBeenCalled()
  })
})

describe('zniffer pure helpers', () => {
  const frames: ZnifferFrame[] = [
    { id: 1, channel: 1, sourceNodeId: 2, destinationNodeId: 1, type: 'ACK', rssi: -60, payload: [0x01, 0x02], corrupted: false },
    { id: 2, channel: 2, sourceNodeId: 3, destinationNodeId: 4, type: 'Singlecast', rssi: -70, payload: 'aa bb', corrupted: true },
    { id: 3, channel: 1, sourceNodeId: 4, destinationNodeId: 2, type: 'Multicast', protocolDataRate: '100k', corrupted: false },
  ]

  it('caps appended frames as a ring buffer', () => {
    expect(appendFrames(frames.slice(0, 2), frames.slice(2), 2)).toEqual(frames.slice(1))
    expect(appendFrames(frames, [], 2)).toEqual(frames)
    expect(appendFrames(frames, frames, 0)).toEqual([])
  })

  it('filters by node, channel, corrupted flag, and free text', () => {
    expect(filterFrames(frames, { node: 2 }).map((frame) => frame.id)).toEqual([1, 3])
    expect(filterFrames(frames, { channel: 2 }).map((frame) => frame.id)).toEqual([2])
    expect(filterFrames(frames, { type: 'Multicast' }).map((frame) => frame.id)).toEqual([3])
    expect(filterFrames(frames, { corruptedOnly: true }).map((frame) => frame.id)).toEqual([2])
    expect(filterFrames(frames, { query: 'single' }).map((frame) => frame.id)).toEqual([2])
    expect(filterFrames(frames, { query: '100k' }).map((frame) => frame.id)).toEqual([3])
  })

  it('computes window ranges with overscan and spacers', () => {
    expect(computeWindow(40, 20, 60, 10, 1)).toEqual({ start: 1, end: 6, padTop: 20, padBottom: 80 })
    expect(computeWindow(-1, 0, 0, -1, -1)).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 })
  })

  it('formats payloads as hex', () => {
    expect(payloadToHex([0, 15, 255])).toBe('00 0f ff')
    expect(payloadToHex(new Uint8Array([1, 2]))).toBe('01 02')
    expect(payloadToHex('aa bb')).toBe('aa bb')
    expect(payloadToHex(null)).toBe('')
  })

  it('parses frequency options from state', () => {
    expect(parseFrequencyOptions({ supportedFrequencies: { 2: 'US', 1: 'EU' }, frequency: 3 })).toEqual([
      { value: 3, label: 'Current (3)' },
      { value: 1, label: 'EU' },
      { value: 2, label: 'US' },
    ])
  })
})

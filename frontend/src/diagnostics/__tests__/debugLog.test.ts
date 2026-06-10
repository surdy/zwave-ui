import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getJson, postJson } from '@/api/rest'
import {
  appendLines,
  computeWindow,
  fetchDebugStatus,
  filterLines,
  linesToBlob,
  parseLogLine,
  startDebug,
  stopDebug,
  stripAnsi,
} from '../debugLog'

vi.mock('@/api/rest', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
}))

const mockedGetJson = vi.mocked(getJson)
const mockedPostJson = vi.mocked(postJson)

describe('debug log helpers', () => {
  beforeEach(() => {
    mockedGetJson.mockReset()
    mockedPostJson.mockReset()
  })

  it('strips ANSI escape sequences', () => {
    expect(stripAnsi('\u001B[32minfo\u001B[0m plain')).toBe('info plain')
  })

  it('detects log levels while preserving raw text', () => {
    expect(parseLogLine('2026-01-01 [Info] ready')).toMatchObject({ level: 'info', text: '2026-01-01 [Info] ready' })
    expect(parseLogLine('\u001B[31mERROR failed\u001B[0m')).toMatchObject({ level: 'error', text: 'ERROR failed' })
    expect(parseLogLine('no level here')).toEqual({ level: undefined, text: 'no level here', raw: 'no level here' })
  })

  it('caps the ring buffer and drops the oldest entries', () => {
    expect(appendLines(['a', 'b'], ['c', 'd', 'e'], 4)).toEqual(['b', 'c', 'd', 'e'])
    expect(appendLines(['a'], ['b'], 0)).toEqual([])
  })

  it('filters by text and level', () => {
    const lines = ['INFO node 1 ready', 'WARN node 2 slow', 'ERROR node 2 failed']
    expect(filterLines(lines, { query: 'NODE 2', level: 'all' })).toEqual(['WARN node 2 slow', 'ERROR node 2 failed'])
    expect(filterLines(lines, { query: 'node 2', level: 'warn' })).toEqual(['WARN node 2 slow'])
  })

  it('computes virtual windows at the top and bottom', () => {
    expect(computeWindow(0, 20, 100, 100, 2)).toEqual({ start: 0, end: 7, padTop: 0, padBottom: 1860 })
    expect(computeWindow(1900, 20, 100, 100, 2)).toEqual({ start: 93, end: 100, padTop: 1860, padBottom: 0 })
    expect(computeWindow(10_000, 20, 100, 10, 2)).toEqual({ start: 3, end: 10, padTop: 60, padBottom: 0 })
    expect(computeWindow(-10, 0, -1, -5, -1)).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 })
  })

  it('creates a plain text blob', async () => {
    await expect(linesToBlob(['a', 'b']).text()).resolves.toBe('a\nb\n')
  })

  it('wraps debug REST endpoints', async () => {
    mockedGetJson.mockResolvedValueOnce({ success: true, active: true })
    mockedPostJson.mockResolvedValueOnce({ success: true })
    mockedPostJson.mockResolvedValueOnce({ success: true })

    await expect(fetchDebugStatus()).resolves.toEqual({ success: true, active: true })
    await expect(startDebug(true)).resolves.toEqual({ success: true })
    await expect(stopDebug()).resolves.toEqual({ success: true })
    expect(mockedGetJson).toHaveBeenCalledWith('/api/debug/status', { signal: undefined })
    expect(mockedPostJson).toHaveBeenNthCalledWith(1, '/api/debug/start', { restartDriver: true })
    expect(mockedPostJson).toHaveBeenNthCalledWith(2, '/api/debug/stop', {})
  })

  it('treats the successful stop archive response as stopped', async () => {
    mockedPostJson.mockRejectedValueOnce(new Error('Expected JSON from /api/debug/stop but got non-JSON response (status 200)'))

    await expect(stopDebug()).resolves.toEqual({ success: true, active: false, message: 'Debug capture stopped' })
  })
})

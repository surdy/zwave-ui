import { getJson, postJson } from '@/api/rest'

export const LOG_LEVELS = ['silly', 'verbose', 'debug', 'info', 'warn', 'error'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]
export type LogLevelFilter = LogLevel | 'all'

export interface ParsedLogLine {
  level?: LogLevel
  text: string
  raw: string
}

export interface LineFilter {
  query?: string
  level?: LogLevelFilter
}

export interface WindowRange {
  start: number
  end: number
  padTop: number
  padBottom: number
}

export interface DebugControlResponse {
  success?: boolean
  active?: boolean
  message?: string
  [key: string]: unknown
}

const ANSI_PATTERN = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g
const LEVEL_PATTERN = /(?:^|[\s:[({])(?:silly|verbose|debug|info|warn|warning|error)(?=$|[\s:\])},-])/i

export function stripAnsi(s: string): string {
  return s.replace(ANSI_PATTERN, '')
}

export function splitChunkToLines(chunk: string): string[] {
  if (!chunk) return []
  const normalized = chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  if (normalized.endsWith('\n')) lines.pop()
  return lines
}

export function createLineAccumulator() {
  let pending = ''

  return {
    push(chunk: string): string[] {
      if (!chunk) return []
      const normalized = (pending + chunk).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const lines = normalized.split('\n')
      pending = normalized.endsWith('\n') ? '' : (lines.pop() ?? '')
      return lines.filter((line) => line.length > 0)
    },
    flush(): string[] {
      if (!pending) return []
      const line = pending
      pending = ''
      return [line]
    },
  }
}

export function parseLogLine(line: string): ParsedLogLine {
  const text = stripAnsi(line)
  const match = text.match(LEVEL_PATTERN)?.[0]?.match(/silly|verbose|debug|info|warn|warning|error/i)?.[0]
  const normalized = match?.toLowerCase() === 'warning' ? 'warn' : match?.toLowerCase()
  const level = LOG_LEVELS.includes(normalized as LogLevel) ? (normalized as LogLevel) : undefined
  return { level, text, raw: line }
}

export function appendLines(buffer: readonly string[], lines: readonly string[], max: number): string[] {
  if (max <= 0) return []
  if (lines.length === 0) return [...buffer]
  const next = [...buffer, ...lines]
  return next.length > max ? next.slice(next.length - max) : next
}

export function filterLines(lines: readonly string[], { query = '', level = 'all' }: LineFilter): string[] {
  const normalizedQuery = query.trim().toLowerCase()
  return lines.filter((line) => {
    const parsed = parseLogLine(line)
    if (level !== 'all' && parsed.level !== level) return false
    if (!normalizedQuery) return true
    return parsed.text.toLowerCase().includes(normalizedQuery)
  })
}

export function computeWindow(
  scrollTop: number,
  rowHeight: number,
  viewportH: number,
  total: number,
  overscan: number,
): WindowRange {
  const safeTotal = Math.max(0, Math.floor(total))
  const safeRowHeight = Math.max(1, rowHeight)
  const safeViewport = Math.max(0, viewportH)
  const safeOverscan = Math.max(0, Math.floor(overscan))
  const visibleCount = Math.ceil(safeViewport / safeRowHeight)
  const maxFirstVisible = Math.max(0, safeTotal - visibleCount)
  const firstVisible = Math.min(maxFirstVisible, Math.max(0, Math.floor(Math.max(0, scrollTop) / safeRowHeight)))
  const start = Math.max(0, firstVisible - safeOverscan)
  const end = Math.min(safeTotal, firstVisible + visibleCount + safeOverscan)

  return {
    start,
    end: Math.max(start, end),
    padTop: start * safeRowHeight,
    padBottom: Math.max(0, safeTotal - Math.max(start, end)) * safeRowHeight,
  }
}

export function linesToBlob(lines: readonly string[]): Blob {
  const text = lines.length > 0 ? `${lines.join('\n')}\n` : ''
  return new Blob([text], { type: 'text/plain;charset=utf-8' })
}

export function fetchDebugStatus(signal?: AbortSignal): Promise<DebugControlResponse> {
  return getJson<DebugControlResponse>('/api/debug/status', { signal })
}

export function startDebug(restartDriver = false): Promise<DebugControlResponse> {
  return postJson<DebugControlResponse>('/api/debug/start', { restartDriver })
}

export async function stopDebug(): Promise<DebugControlResponse> {
  try {
    return await postJson<DebugControlResponse>('/api/debug/stop', {})
  } catch (error) {
    if (error instanceof Error && error.message.includes('non-JSON response (status 200)')) {
      return { success: true, active: false, message: 'Debug capture stopped' }
    }
    throw error
  }
}

export function cancelDebug(): Promise<DebugControlResponse> {
  return postJson<DebugControlResponse>('/api/debug/cancel', {})
}

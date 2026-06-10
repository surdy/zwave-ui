import { getStoredToken, type CallApiResult } from '@/api'
import { getJson, type RequestOptions } from '@/api/rest'
import { zwaveSocket } from '@/api/socket'
import { getSettings, updateSettings, type SettingsPatch, type SettingsResponse } from '@/settings/settingsApi'

export interface BackupSettingsForm {
  storeBackup: boolean
  storeCron: string
  storeKeep: number | null
  nvmBackup: boolean
  nvmBackupOnEvent: boolean
  nvmCron: string
  nvmKeep: number | null
}

export interface BackupFieldErrors {
  storeCron?: string
  storeKeep?: string
  nvmCron?: string
  nvmKeep?: string
}

export interface StoreFileEntry {
  name: string
  path: string
  size?: string | number
  modified?: string | number
  mtime?: string | number
  mtimeMs?: number
  ext?: string
  isRoot?: boolean
  isDirectory?: boolean
  children?: StoreFileEntry[]
}

export interface StoreBackupFile {
  name: string
  path: string
  directory: string
  size?: string | number
  modified?: string
  timestamp?: number
  kind: 'store' | 'nvm' | 'config' | 'backup'
}

export interface StoreResponse<T = unknown> {
  success?: boolean
  data?: T
  message?: string
}

export interface NvmBackupResult {
  data: unknown
  fileName?: string
}

const DEFAULT_FORM: BackupSettingsForm = {
  storeBackup: false,
  storeCron: '0 0 * * *',
  storeKeep: 7,
  nvmBackup: false,
  nvmBackupOnEvent: false,
  nvmCron: '0 0 * * *',
  nvmKeep: 7,
}

const CRON_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function settingsRoot(response: SettingsResponse): Record<string, unknown> {
  return isRecord(response.settings) ? response.settings : response
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function numberValue(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function directoryName(path: string): string {
  const index = path.lastIndexOf('/')
  return index >= 0 ? path.slice(0, index) : ''
}

function fileExtension(entry: StoreFileEntry): string {
  const ext = typeof entry.ext === 'string' ? entry.ext : entry.name.split('.').pop()
  return (ext ?? '').toLowerCase()
}

function parseFileDate(name: string): number | undefined {
  const match = name.match(/(\d{14})/)
  if (!match) return undefined
  const stamp = match[1]
  const date = Date.UTC(
    Number(stamp.slice(0, 4)),
    Number(stamp.slice(4, 6)) - 1,
    Number(stamp.slice(6, 8)),
    Number(stamp.slice(8, 10)),
    Number(stamp.slice(10, 12)),
    Number(stamp.slice(12, 14)),
  )
  return Number.isFinite(date) ? date : undefined
}

function modifiedTimestamp(entry: StoreFileEntry): number | undefined {
  if (typeof entry.mtimeMs === 'number' && Number.isFinite(entry.mtimeMs)) return entry.mtimeMs
  const value = entry.modified ?? entry.mtime
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const timestamp = Date.parse(value)
    if (Number.isFinite(timestamp)) return timestamp
  }
  return parseFileDate(entry.name)
}

function backupKind(entry: StoreFileEntry): StoreBackupFile['kind'] {
  const name = entry.name.toLowerCase()
  const path = entry.path.toLowerCase()
  if (name.startsWith('store-backup_') || path.includes('/backups/store/')) return 'store'
  if (name.startsWith('nvm_') || path.includes('/backups/nvm/')) return 'nvm'
  if (name.includes('config')) return 'config'
  return 'backup'
}

function isBackupFile(entry: StoreFileEntry): boolean {
  if (entry.children || entry.isDirectory) return false
  const ext = fileExtension(entry)
  if (!['zip', 'bin', 'json'].includes(ext)) return false
  const haystack = `${entry.name} ${entry.path}`.toLowerCase()
  return haystack.includes('backup') || haystack.includes('/backups/') || haystack.includes('nvm_')
}

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  const token = getStoredToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

function responseFileName(response: Response, fallback: string): string {
  const header = response.headers.get('Content-Disposition') ?? response.headers.get('content-disposition')
  const match = header?.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i)
  return match ? decodeURIComponent(match[1].replace(/\"/g, '').trim()) : fallback
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function fetchBlob(url: string, fallbackName: string, init: RequestInit = {}): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: authHeaders({ Accept: 'application/octet-stream', ...(init.headers as Record<string, string> | undefined) }),
  })
  if (!response.ok) throw new Error(`Download failed (${response.status})`)
  return { blob: await response.blob(), fileName: responseFileName(response, fallbackName) }
}

export function fromSettings(response: SettingsResponse): BackupSettingsForm {
  const root = settingsRoot(response)
  const backup = isRecord(root.backup) ? root.backup : {}
  return {
    storeBackup: booleanValue(backup.storeBackup, DEFAULT_FORM.storeBackup),
    storeCron: stringValue(backup.storeCron, DEFAULT_FORM.storeCron),
    storeKeep: numberValue(backup.storeKeep, DEFAULT_FORM.storeKeep),
    nvmBackup: booleanValue(backup.nvmBackup, DEFAULT_FORM.nvmBackup),
    nvmBackupOnEvent: booleanValue(backup.nvmBackupOnEvent, DEFAULT_FORM.nvmBackupOnEvent),
    nvmCron: stringValue(backup.nvmCron, DEFAULT_FORM.nvmCron),
    nvmKeep: numberValue(backup.nvmKeep, DEFAULT_FORM.nvmKeep),
  }
}

export function toSettingsPatch(form: BackupSettingsForm): SettingsPatch {
  return {
    backup: {
      storeBackup: form.storeBackup,
      storeCron: form.storeCron.trim(),
      storeKeep: form.storeKeep ?? DEFAULT_FORM.storeKeep,
      nvmBackup: form.nvmBackup,
      nvmBackupOnEvent: form.nvmBackupOnEvent,
      nvmCron: form.nvmCron.trim(),
      nvmKeep: form.nvmKeep ?? DEFAULT_FORM.nvmKeep,
    },
  }
}

export function isValidCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/)
  return fields.length === 5 && fields.every((field, index) => isValidCronField(field, CRON_RANGES[index]))
}

export function validateBackupForm(form: BackupSettingsForm): BackupFieldErrors {
  const errors: BackupFieldErrors = {}
  if (form.storeBackup && !isValidCron(form.storeCron)) errors.storeCron = 'Use a valid 5-field cron expression.'
  if (form.nvmBackup && !isValidCron(form.nvmCron)) errors.nvmCron = 'Use a valid 5-field cron expression.'
  if (form.storeBackup && !isPositiveInteger(form.storeKeep)) errors.storeKeep = 'Use a keep count of 1 or more.'
  if (form.nvmBackup && !isPositiveInteger(form.nvmKeep)) errors.nvmKeep = 'Use a keep count of 1 or more.'
  return errors
}

export function hasBackupErrors(errors: BackupFieldErrors): boolean {
  return Boolean(errors.storeCron || errors.storeKeep || errors.nvmCron || errors.nvmKeep)
}

export function flattenStoreEntries(data: unknown): StoreBackupFile[] {
  const files: StoreBackupFile[] = []
  const visit = (entry: StoreFileEntry) => {
    if (Array.isArray(entry.children)) entry.children.forEach(visit)
    if (!isBackupFile(entry)) return
    const timestamp = modifiedTimestamp(entry)
    files.push({
      name: entry.name,
      path: entry.path,
      directory: directoryName(entry.path),
      size: entry.size,
      modified: timestamp ? new Date(timestamp).toISOString() : undefined,
      timestamp,
      kind: backupKind(entry),
    })
  }

  if (Array.isArray(data)) data.filter(isStoreEntry).forEach(visit)
  else if (isStoreEntry(data)) visit(data)

  return files.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0) || b.name.localeCompare(a.name))
}

export function getStoreRootPath(data: unknown): string {
  if (!Array.isArray(data)) return ''
  const root = data.find((entry): entry is StoreFileEntry => isStoreEntry(entry) && Boolean(entry.isRoot))
  return root?.path ?? ''
}

export function nvmBackupFilename(date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  return `zwave-controller-nvm-${stamp}.bin`
}

export function bytesFromValue(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (Array.isArray(value)) return new Uint8Array(value.filter((entry): entry is number => typeof entry === 'number'))
  if (isRecord(value) && Array.isArray(value.data)) return bytesFromValue(value.data)
  return new Uint8Array()
}

export function bytesToBlob(bytes: Uint8Array, type = 'application/octet-stream'): Blob {
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([data], { type })
}

export function restoreConfirmationMatches(typed: string | number | boolean | null | undefined, expected = 'RESTORE'): boolean {
  return typeof typed === 'string' && expected.length > 0 && typed.trim() === expected
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export async function loadBackupSettings(opts: RequestOptions = {}): Promise<BackupSettingsForm> {
  return fromSettings(await getSettings(opts))
}

export function saveBackupSettings(form: BackupSettingsForm, opts: RequestOptions = {}): Promise<SettingsResponse> {
  return updateSettings(toSettingsPatch(form), opts)
}

export async function loadStoreBackupListing(opts: RequestOptions = {}): Promise<{ files: StoreBackupFile[]; storePath: string }> {
  const response = await getJson<StoreResponse>('/api/store', opts)
  if (response?.success === false) throw new Error(response.message || 'Unable to load store backups')
  return { files: flattenStoreEntries(response.data), storePath: getStoreRootPath(response.data) }
}

export async function deleteStoreFile(path: string): Promise<StoreResponse> {
  const response = await fetch(`/api/store?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: authHeaders({ Accept: 'application/json' }),
  })
  const result = await parseJsonResponse<StoreResponse>(response)
  if (!response.ok || result?.success === false) throw new Error(result?.message || `Delete failed (${response.status})`)
  return result
}

export async function createStoreBackupDownload(): Promise<{ blob: Blob; fileName: string }> {
  try {
    return await fetchBlob('/api/store/backup', 'store-backup.zip', { method: 'POST' })
  } catch {
    return fetchBlob('/api/store/backup', 'store-backup.zip', { method: 'GET' })
  }
}

export function downloadConfigExport(): Promise<{ blob: Blob; fileName: string }> {
  return fetchBlob('/api/exportConfig', 'zwave-js-ui-config.zip')
}

export function downloadStoreFiles(paths: string[]): Promise<{ blob: Blob; fileName: string }> {
  return fetchBlob('/api/store-multi', 'zwave-js-ui-store.zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: paths }),
  })
}

export async function restoreStoreBackup(file: File): Promise<StoreResponse> {
  const body = new FormData()
  body.append('upload', file)
  body.append('restore', 'true')
  const response = await fetch('/api/store/upload', {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
    body,
  })
  const result = await parseJsonResponse<StoreResponse>(response)
  if (!response.ok || result?.success === false) throw new Error(result?.message || `Restore failed (${response.status})`)
  return result
}

export function backupNVMRaw(): Promise<CallApiResult<NvmBackupResult>> {
  return zwaveSocket.callApi('backupNVMRaw')
}

export function restoreNVM(bytes: Uint8Array): Promise<CallApiResult<unknown>> {
  return zwaveSocket.callApi('restoreNVM', bytes)
}

function isPositiveInteger(value: number | null): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function isValidCronField(field: string, range: readonly [number, number]): boolean {
  return field.split(',').every((part) => isValidCronPart(part, range))
}

function isValidCronPart(part: string, range: readonly [number, number]): boolean {
  const [base, step, extra] = part.split('/')
  if (extra !== undefined) return false
  if (step !== undefined && !isPositiveStep(step)) return false
  if (base === '*') return true
  const bounds = base.split('-')
  if (bounds.length === 1) return isInRange(bounds[0], range)
  if (bounds.length !== 2) return false
  const start = numberFrom(bounds[0])
  const end = numberFrom(bounds[1])
  return start !== null && end !== null && start <= end && inRange(start, range) && inRange(end, range)
}

function isPositiveStep(value: string): boolean {
  const step = numberFrom(value)
  return step !== null && step >= 1
}

function isInRange(value: string, range: readonly [number, number]): boolean {
  const number = numberFrom(value)
  return number !== null && inRange(number, range)
}

function inRange(value: number, [min, max]: readonly [number, number]): boolean {
  return value >= min && value <= max
}

function numberFrom(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

function isStoreEntry(value: unknown): value is StoreFileEntry {
  return isRecord(value) && typeof value.name === 'string' && typeof value.path === 'string'
}

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseNumberField from '@/components/base/BaseNumberField.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import {
  backupNVMRaw,
  bytesFromValue,
  bytesToBlob,
  createStoreBackupDownload,
  deleteStoreFile,
  downloadBlob,
  downloadConfigExport,
  downloadStoreFiles,
  fromSettings,
  hasBackupErrors,
  loadBackupSettings,
  loadStoreBackupListing,
  nvmBackupFilename,
  restoreConfirmationMatches,
  restoreNVM,
  restoreStoreBackup,
  saveBackupSettings,
  validateBackupForm,
  type BackupFieldErrors,
  type BackupSettingsForm,
  type StoreBackupFile,
} from '@/settings/backup'

const form = reactive<BackupSettingsForm>(fromSettings({ settings: {} }))
const errors = ref<BackupFieldErrors>({})
const backups = ref<StoreBackupFile[]>([])
const storePath = ref('')
const loading = ref(false)
const refreshing = ref(false)
const saving = ref(false)
const busyAction = ref<string | null>(null)
const savedAt = ref<Date | null>(null)
const storeRestoreInput = ref<HTMLInputElement | null>(null)
const nvmRestoreInput = ref<HTMLInputElement | null>(null)

const toast = useToast()
const { confirm, prompt } = useConfirm()

const storeBackups = computed(() => backups.value.filter((backup) => backup.kind === 'store' || backup.kind === 'config' || backup.kind === 'backup'))
const nvmBackups = computed(() => backups.value.filter((backup) => backup.kind === 'nvm'))
const latestStoreBackup = computed(() => storeBackups.value[0])
const latestNvmBackup = computed(() => nvmBackups.value[0])
const savedMessage = computed(() => (savedAt.value ? `Saved ${savedAt.value.toLocaleTimeString()}` : 'Schedules save to the backup section of backend settings.'))

function replaceForm(next: BackupSettingsForm) {
  Object.assign(form, next)
}

async function loadAll() {
  loading.value = true
  try {
    const [settings] = await Promise.all([loadBackupSettings(), refreshBackups()])
    replaceForm(settings)
    errors.value = {}
  } catch (error) {
    toast.error(messageFrom(error, 'Unable to load backup settings.'))
  } finally {
    loading.value = false
  }
}

async function refreshBackups() {
  refreshing.value = true
  try {
    const listing = await loadStoreBackupListing()
    backups.value = listing.files
    storePath.value = listing.storePath
  } catch (error) {
    toast.error(messageFrom(error, 'Unable to load store backups.'))
  } finally {
    refreshing.value = false
  }
}

async function saveSchedules() {
  const nextErrors = validateBackupForm(form)
  errors.value = nextErrors
  if (hasBackupErrors(nextErrors)) {
    toast.error('Fix the highlighted backup schedule fields before saving.')
    return
  }

  saving.value = true
  try {
    await saveBackupSettings(form)
    savedAt.value = new Date()
    toast.success('Backup schedules saved.')
  } catch (error) {
    toast.error(messageFrom(error, 'Unable to save backup settings.'))
  } finally {
    saving.value = false
  }
}

async function exportConfig() {
  await runDownload('config-export', async () => {
    const download = await downloadConfigExport()
    downloadBlob(download.blob, download.fileName)
    toast.success('Configuration export downloaded.')
  })
}

async function createStoreBackup() {
  await runDownload('store-backup', async () => {
    const download = await createStoreBackupDownload()
    downloadBlob(download.blob, download.fileName)
    toast.success('Store backup created and downloaded.')
    await refreshBackups()
  })
}

async function downloadBackup(backup: StoreBackupFile) {
  await runDownload(`download:${backup.path}`, async () => {
    const download = await downloadStoreFiles([backup.path])
    downloadBlob(download.blob, download.fileName || `${backup.name}.zip`)
    toast.success(`${backup.name} downloaded.`)
  })
}

async function deleteBackup(backup: StoreBackupFile) {
  const ok = await confirm({
    title: 'Delete backup?',
    message: `Delete ${backup.name}? This removes the file from ${backup.directory || 'the store'}.`,
    confirmText: 'Delete backup',
    danger: true,
  })
  if (!ok) return

  busyAction.value = `delete:${backup.path}`
  try {
    await deleteStoreFile(backup.path)
    backups.value = backups.value.filter((item) => item.path !== backup.path)
    toast.success(`${backup.name} deleted.`)
  } catch (error) {
    toast.error(messageFrom(error, 'Unable to delete backup.'))
  } finally {
    busyAction.value = null
  }
}

function chooseStoreRestore() {
  storeRestoreInput.value?.click()
}

function chooseNvmRestore() {
  nvmRestoreInput.value?.click()
}

async function onStoreRestoreSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  await restoreStore(file)
}

async function onNvmRestoreSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  await restoreNvm(file)
}

async function restoreStore(file: File) {
  const typed = await prompt({
    title: 'Restore store backup?',
    message: `This extracts ${file.name} over the backend store. Existing settings and Z-Wave JS data may be replaced. Type RESTORE to continue.`,
    confirmText: 'Restore store',
    danger: true,
    input: { type: 'text', label: 'Type RESTORE to continue' },
  })
  if (!restoreConfirmationMatches(typed)) {
    if (typed !== null) toast.error('Store restore confirmation did not match.')
    return
  }

  busyAction.value = 'store-restore'
  try {
    await restoreStoreBackup(file)
    toast.success('Store backup restored.')
    await refreshBackups()
  } catch (error) {
    toast.error(messageFrom(error, 'Unable to restore store backup.'))
  } finally {
    busyAction.value = null
  }
}

async function downloadNvmBackup() {
  busyAction.value = 'nvm-backup'
  try {
    const response = await backupNVMRaw()
    if (!response.success) throw new Error(response.message || 'NVM backup failed.')
    const result = response.result ?? (response as unknown)
    const data = isRecord(result) ? result.data : result
    const bytes = bytesFromValue(data)
    if (!bytes.byteLength) throw new Error('NVM backup returned no data.')
    const fileName = isRecord(result) && typeof result.fileName === 'string' ? ensureBinExtension(result.fileName) : nvmBackupFilename()
    downloadBlob(bytesToBlob(bytes), fileName)
    toast.success('NVM backup downloaded.')
    await refreshBackups()
  } catch (error) {
    toast.error(messageFrom(error, 'Unable to download NVM backup.'))
  } finally {
    busyAction.value = null
  }
}

async function restoreNvm(file: File) {
  const typed = await prompt({
    title: 'Restore controller NVM?',
    message: `This overwrites controller NVM with ${file.name}. The wrong file can permanently break this Z-Wave network. Type RESTORE to continue.`,
    confirmText: 'Restore NVM',
    danger: true,
    input: { type: 'text', label: 'Type RESTORE to continue' },
  })
  if (!restoreConfirmationMatches(typed)) {
    if (typed !== null) toast.error('NVM restore confirmation did not match.')
    return
  }

  busyAction.value = 'nvm-restore'
  try {
    const response = await restoreNVM(new Uint8Array(await file.arrayBuffer()))
    if (!response.success) throw new Error(response.message || 'NVM restore failed.')
    toast.success('NVM restore started.')
  } catch (error) {
    toast.error(messageFrom(error, 'Unable to restore NVM backup.'))
  } finally {
    busyAction.value = null
  }
}

async function runDownload(action: string, run: () => Promise<void>) {
  busyAction.value = action
  try {
    await run()
  } catch (error) {
    toast.error(messageFrom(error, 'Download failed.'))
  } finally {
    busyAction.value = null
  }
}

function formatModified(backup?: StoreBackupFile): string {
  if (!backup?.modified) return 'Not found in store listing'
  return new Date(backup.modified).toLocaleString()
}

function ensureBinExtension(fileName: string): string {
  return fileName.endsWith('.bin') || fileName.endsWith('.nvm') ? fileName : `${fileName}.bin`
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

onMounted(loadAll)
</script>

<template>
  <form class="backup-settings" @submit.prevent="saveSchedules">
    <header class="page-header">
      <div>
        <p class="page-header__kicker">Backup & restore</p>
        <h2>Protect store files and controller NVM</h2>
        <p>Download exports, review saved backups, restore guarded archives, and schedule automatic store or NVM backups.</p>
      </div>
      <div class="status-panel" aria-live="polite">
        <span class="status-panel__label">Store path</span>
        <strong>{{ storePath || 'Loading…' }}</strong>
      </div>
    </header>

    <BaseCard>
      <template #header>Manual store backups</template>
      <div class="settings-grid">
        <div class="summary-grid">
          <div class="summary-card">
            <StatusDot :status="latestStoreBackup ? 'ok' : 'idle'" />
            <div>
              <strong>Last store backup</strong>
              <p>{{ formatModified(latestStoreBackup) }}</p>
            </div>
          </div>
          <div class="summary-card">
            <StatusDot :status="latestNvmBackup ? 'ok' : 'idle'" />
            <div>
              <strong>Last NVM backup</strong>
              <p>{{ formatModified(latestNvmBackup) }}</p>
            </div>
          </div>
        </div>

        <div class="button-row">
          <BaseButton variant="secondary" :loading="busyAction === 'config-export'" :disabled="loading || busyAction !== null" @click="exportConfig">
            Download config export
          </BaseButton>
          <BaseButton :loading="busyAction === 'store-backup'" :disabled="loading || busyAction !== null" @click="createStoreBackup">
            Create store backup
          </BaseButton>
          <BaseButton variant="secondary" :loading="refreshing" :disabled="loading || busyAction !== null" @click="refreshBackups">Refresh list</BaseButton>
        </div>

        <div v-if="backups.length" class="backup-list" aria-live="polite">
          <article v-for="backup in backups" :key="backup.path" class="backup-item">
            <div>
              <div class="backup-item__title">
                <strong>{{ backup.name }}</strong>
                <span class="backup-item__kind">{{ backup.kind }}</span>
              </div>
              <p>{{ backup.directory }}</p>
              <p class="backup-item__meta">
                <span v-if="backup.size">{{ backup.size }}</span>
                <span v-if="backup.modified">{{ new Date(backup.modified).toLocaleString() }}</span>
              </p>
            </div>
            <div class="backup-item__actions">
              <BaseButton variant="secondary" size="sm" :disabled="busyAction !== null" :loading="busyAction === `download:${backup.path}`" @click="downloadBackup(backup)">
                Download
              </BaseButton>
              <BaseButton variant="danger" size="sm" :disabled="busyAction !== null" :loading="busyAction === `delete:${backup.path}`" @click="deleteBackup(backup)">
                Delete
              </BaseButton>
            </div>
          </article>
        </div>
        <EmptyState v-else icon="💾" title="No backups found" description="Backups are detected under the store backups tree when .zip, .bin, or .json backup files exist." />

        <AdvancedOnly>
          <div class="danger-zone">
            <div>
              <h3>Restore store backup</h3>
              <p>Expert action: upload a zip created by store backup. The backend `/api/store/upload` restore endpoint extracts it over the store directory.</p>
            </div>
            <BaseButton variant="danger" :loading="busyAction === 'store-restore'" :disabled="loading || busyAction !== null" @click="chooseStoreRestore">
              Upload & restore store
            </BaseButton>
            <input ref="storeRestoreInput" class="sr-only" type="file" accept=".zip,application/zip" @change="onStoreRestoreSelected" />
          </div>
        </AdvancedOnly>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>NVM backup & restore</template>
      <div class="settings-grid">
        <p class="section-hint">
          Controller NVM contains the Z-Wave network. These actions also exist in
          <RouterLink :to="{ name: 'controller-maintenance' }">Controller Maintenance</RouterLink>.
        </p>
        <div class="button-row">
          <BaseButton :loading="busyAction === 'nvm-backup'" :disabled="loading || busyAction !== null" @click="downloadNvmBackup">Download NVM backup</BaseButton>
          <AdvancedOnly tag="span">
            <BaseButton variant="danger" :loading="busyAction === 'nvm-restore'" :disabled="loading || busyAction !== null" @click="chooseNvmRestore">
              Restore NVM from file
            </BaseButton>
            <input ref="nvmRestoreInput" class="sr-only" type="file" accept=".bin,.nvm,application/octet-stream" @change="onNvmRestoreSelected" />
          </AdvancedOnly>
        </div>
        <div class="warning-box">
          <strong>Restore warning</strong>
          <p>Only restore NVM to the matching controller. The wrong image can make devices unreachable or permanently damage the network.</p>
        </div>
      </div>
    </BaseCard>

    <BaseCard>
      <template #header>Backup scheduling</template>
      <div class="settings-grid settings-grid--two">
        <section class="schedule-panel">
          <div class="setting-row">
            <div>
              <h3>Store backup</h3>
              <p>Automatically create store zip backups.</p>
            </div>
            <BaseSwitch v-model="form.storeBackup" label="Enabled" :disabled="loading || saving" />
          </div>
          <BaseTextField v-model="form.storeCron" label="Store cron" placeholder="0 0 * * *" hint="Five-field cron expression." :error="errors.storeCron" :disabled="loading || saving || !form.storeBackup" />
          <BaseNumberField v-model="form.storeKeep" label="Store backups to keep" :min="1" :step="1" :error="errors.storeKeep" :disabled="loading || saving || !form.storeBackup" />
        </section>

        <section class="schedule-panel">
          <div class="setting-row">
            <div>
              <h3>NVM backup</h3>
              <p>Automatically create raw controller NVM backups.</p>
            </div>
            <BaseSwitch v-model="form.nvmBackup" label="Enabled" :disabled="loading || saving" />
          </div>
          <div class="setting-row">
            <div>
              <h3>NVM backup on event</h3>
              <p>Backup before node add, remove, or replace operations.</p>
            </div>
            <BaseSwitch v-model="form.nvmBackupOnEvent" label="Events" :disabled="loading || saving" />
          </div>
          <BaseTextField v-model="form.nvmCron" label="NVM cron" placeholder="0 0 * * *" hint="Five-field cron expression." :error="errors.nvmCron" :disabled="loading || saving || !form.nvmBackup" />
          <BaseNumberField v-model="form.nvmKeep" label="NVM backups to keep" :min="1" :step="1" :error="errors.nvmKeep" :disabled="loading || saving || !form.nvmBackup" />
        </section>
      </div>
    </BaseCard>

    <footer class="actions">
      <span class="save-status">{{ savedMessage }}</span>
      <div class="actions__buttons">
        <BaseButton variant="secondary" :disabled="loading || saving" @click="loadAll">Reset</BaseButton>
        <BaseButton type="submit" :loading="saving" :disabled="loading">Save backup schedules</BaseButton>
      </div>
    </footer>
  </form>
</template>

<style scoped>
.backup-settings {
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
}
.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.page-header__kicker {
  margin: 0 0 var(--s-1);
  color: var(--color-primary-strong);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.page-header h2,
.schedule-panel h3,
.danger-zone h3 {
  margin: 0;
}
.page-header h2 {
  font-size: clamp(1.4rem, 3vw, 2rem);
}
.page-header p,
.section-hint,
.setting-row p,
.summary-card p,
.backup-item p,
.danger-zone p,
.warning-box p {
  margin: var(--s-1) 0 0;
  color: var(--color-text-muted);
}
.status-panel,
.save-status {
  padding: var(--s-2) var(--s-3);
  color: var(--color-primary-strong);
  background: var(--color-primary-soft);
  border-radius: var(--r-md);
}
.status-panel {
  display: grid;
  gap: var(--s-1);
  align-self: flex-start;
  max-width: 100%;
}
.status-panel strong {
  overflow-wrap: anywhere;
}
.status-panel__label {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.settings-grid,
.schedule-panel {
  display: grid;
  gap: var(--s-5);
}
.summary-grid,
.backup-list {
  display: grid;
  gap: var(--s-3);
}
.summary-card,
.setting-row,
.backup-item,
.danger-zone,
.warning-box {
  padding: var(--s-4);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
}
.summary-card {
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
}
.setting-row,
.danger-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
}
.setting-row h3,
.danger-zone h3 {
  font-size: 0.9375rem;
}
.button-row,
.actions,
.actions__buttons,
.backup-item__actions,
.backup-item__title,
.backup-item__meta {
  display: flex;
  gap: var(--s-3);
}
.button-row,
.actions__buttons,
.backup-item__meta,
.backup-item__title {
  flex-wrap: wrap;
}
.backup-item {
  display: grid;
  gap: var(--s-3);
}
.backup-item__kind {
  padding: var(--s-1) var(--s-2);
  color: var(--color-primary-strong);
  background: var(--color-primary-soft);
  border-radius: var(--r-pill);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}
.backup-item__actions {
  flex-wrap: wrap;
  align-items: flex-start;
}
.danger-zone,
.warning-box {
  border-color: var(--danger);
  background: var(--danger-soft);
}
.actions {
  flex-direction: column;
}
.save-status {
  align-self: flex-start;
  font-size: 0.8125rem;
  font-weight: 700;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
a {
  color: var(--color-primary-strong);
}

@media (min-width: 720px) {
  .page-header,
  .actions,
  .backup-item {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
  .page-header,
  .actions {
    display: flex;
  }
  .settings-grid--two,
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .backup-item {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}
</style>

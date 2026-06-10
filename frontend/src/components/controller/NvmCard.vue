<script setup lang="ts">
import { ref } from 'vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'

const props = defineProps<{
  disabled?: boolean
  backupLoading?: boolean
  restoreLoading?: boolean
}>()

const emit = defineEmits<{
  backup: []
  restore: [file: File]
}>()

const selectedFile = ref<File | null>(null)

function onFile(event: Event) {
  selectedFile.value = ((event.target as HTMLInputElement).files ?? [])[0] ?? null
}
</script>

<template>
  <BaseCard>
    <template #header>
      <div class="card-title">
        <span>NVM backup / restore</span>
        <BaseBadge variant="expert">Expert</BaseBadge>
      </div>
    </template>

    <p class="muted">Backup downloads a raw controller NVM image. Restore overwrites controller memory and can destroy the network if the file is wrong.</p>

    <div class="danger-box">
      <strong>Restore is irreversible.</strong>
      <span>Only restore a known-good backup for this exact controller. The UI requires typed confirmation before upload is sent.</span>
    </div>

    <label class="file-field">
      <span>NVM backup file</span>
      <input type="file" accept=".bin,.nvm,application/octet-stream" :disabled="disabled || restoreLoading" @change="onFile" />
    </label>

    <template #footer>
      <div class="actions">
        <BaseButton variant="secondary" :loading="backupLoading" :disabled="disabled || restoreLoading" @click="emit('backup')">Download backup</BaseButton>
        <BaseButton variant="danger" :loading="restoreLoading" :disabled="props.disabled || backupLoading || !selectedFile" @click="selectedFile && emit('restore', selectedFile)">
          Restore selected file
        </BaseButton>
      </div>
    </template>
  </BaseCard>
</template>

<style scoped>
.card-title,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
}
.muted {
  margin: 0 0 var(--s-4);
  color: var(--color-text-muted);
}
.danger-box {
  display: grid;
  gap: var(--s-1);
  padding: var(--s-4);
  margin-bottom: var(--s-4);
  color: var(--danger);
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  border-radius: var(--r-md);
}
.file-field {
  display: grid;
  gap: var(--s-2);
  font-weight: 600;
}
.file-field input {
  max-width: 100%;
  color: var(--color-text);
}
.actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import type { FirmwareState } from '@/devices/firmware'

const props = defineProps<{
  state: FirmwareState
  disabled?: boolean
  loading?: boolean
  aborting?: boolean
  canAbort?: boolean
}>()

const emit = defineEmits<{
  update: [file: File]
  abort: []
}>()

const selectedFile = ref<File | null>(null)
const phaseDot = computed(() => {
  if (props.state.phase === 'success') return 'ok'
  if (props.state.phase === 'error') return 'danger'
  if (props.state.phase === 'aborted') return 'warn'
  if (props.state.phase === 'updating' || props.state.phase === 'checking') return 'info'
  return 'idle'
})

function onFile(event: Event) {
  selectedFile.value = ((event.target as HTMLInputElement).files ?? [])[0] ?? null
}
</script>

<template>
  <BaseCard>
    <template #header>
      <div class="card-title">
        <span>Controller OTW firmware</span>
        <BaseBadge variant="expert">Expert</BaseBadge>
      </div>
    </template>

    <p class="muted">Updates controller firmware over the wire. Do not power off the controller, radio stick, or host during the update.</p>

    <div class="danger-box">A failed controller firmware update can leave the controller unusable and may require manual recovery.</div>

    <label class="file-field">
      <span>Firmware file</span>
      <input type="file" :disabled="disabled || loading" @change="onFile" />
    </label>

    <div class="progress-head">
      <span><StatusDot :status="phaseDot" :pulse="state.phase === 'updating'" /> {{ state.status }}</span>
      <strong>{{ state.percent }}%</strong>
    </div>
    <div class="progress"><span :style="{ width: `${state.percent}%` }" /></div>
    <p v-if="state.error" class="error">{{ state.error }}</p>

    <template #footer>
      <div class="actions">
        <BaseButton variant="danger" :loading="loading" :disabled="disabled || !selectedFile || state.phase === 'updating'" @click="selectedFile && emit('update', selectedFile)">
          Start OTW update
        </BaseButton>
        <BaseButton variant="secondary" :loading="aborting" :disabled="disabled || !canAbort || state.phase !== 'updating'" @click="emit('abort')">Abort</BaseButton>
      </div>
    </template>
  </BaseCard>
</template>

<style scoped>
.card-title,
.progress-head,
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
  padding: var(--s-4);
  margin-bottom: var(--s-4);
  color: var(--danger);
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  border-radius: var(--r-md);
  font-weight: 600;
}
.file-field {
  display: grid;
  gap: var(--s-2);
  margin-bottom: var(--s-4);
  font-weight: 600;
}
.file-field input {
  max-width: 100%;
  color: var(--color-text);
}
.progress-head span {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
}
.progress {
  height: 10px;
  overflow: hidden;
  background: var(--color-surface-2);
  border-radius: var(--r-pill);
  margin-top: var(--s-3);
}
.progress span {
  display: block;
  height: 100%;
  background: var(--color-primary);
  border-radius: inherit;
}
.error {
  color: var(--danger);
}
.actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>

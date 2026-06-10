<script setup lang="ts">
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'

const props = defineProps<{
  disabled?: boolean
  busyAction?: string | null
}>()

const emit = defineEmits<{
  softReset: []
  restart: []
  shutdown: []
  hardReset: []
}>()

function loading(action: string) {
  return props.busyAction === action
}
</script>

<template>
  <BaseCard>
    <template #header>
      <div class="card-title">
        <span>Reset / restart</span>
        <BaseBadge variant="expert">Expert</BaseBadge>
      </div>
    </template>

    <p class="muted">Controller resets interrupt the Z-Wave driver. Hard reset factory-resets the controller and erases the network.</p>
    <div class="danger-box"><strong>Hard reset erases every included node from controller memory.</strong> It requires typed confirmation.</div>

    <div class="reset-grid">
      <div>
        <h3>Soft reset</h3>
        <p>Restarts the controller chip without erasing NVM.</p>
        <BaseButton variant="secondary" :loading="loading('soft-reset')" :disabled="disabled" @click="emit('softReset')">Soft reset</BaseButton>
      </div>
      <div>
        <h3>Restart driver</h3>
        <p>Restarts the Z-Wave JS driver connection.</p>
        <BaseButton variant="secondary" :loading="loading('restart')" :disabled="disabled" @click="emit('restart')">Restart</BaseButton>
      </div>
      <div>
        <h3>Shutdown Z-Wave API</h3>
        <p>Stops the API; some sticks require unplug/replug to recover.</p>
        <BaseButton variant="danger" :loading="loading('shutdown')" :disabled="disabled" @click="emit('shutdown')">Shutdown API</BaseButton>
      </div>
      <div>
        <h3>Factory hard reset</h3>
        <p>Irreversibly erases the controller network. Devices must be excluded or reset before reuse.</p>
        <BaseButton variant="danger" :loading="loading('hard-reset')" :disabled="disabled" @click="emit('hardReset')">Hard reset</BaseButton>
      </div>
    </div>
  </BaseCard>
</template>

<style scoped>
.card-title {
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
.reset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s-4);
}
.reset-grid > div {
  display: grid;
  gap: var(--s-3);
  align-content: start;
  padding: var(--s-4);
  background: var(--color-surface-2);
  border-radius: var(--r-md);
}
h3,
p {
  margin: 0;
}
p {
  color: var(--color-text-muted);
}
@media (max-width: 720px) {
  .reset-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import BaseCard from '@/components/base/BaseCard.vue'

const props = defineProps<{
  statistics: unknown
  linkProgress: unknown
  updatedAt?: number | null
}>()

function preview(value: unknown): string {
  if (value == null) return 'Waiting for live statistics…'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
</script>

<template>
  <div class="statistics-panel">
    <BaseCard>
      <template #header>Controller / node statistics</template>
      <p class="statistics-panel__updated">Updated {{ updatedAt ? new Date(updatedAt).toLocaleTimeString() : '—' }}</p>
      <pre>{{ preview(props.statistics) }}</pre>
    </BaseCard>
    <BaseCard>
      <template #header>Link reliability progress</template>
      <pre>{{ preview(props.linkProgress) }}</pre>
    </BaseCard>
  </div>
</template>

<style scoped>
.statistics-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--s-4);
}
.statistics-panel__updated {
  margin-top: 0;
  color: var(--color-text-muted);
}
pre {
  max-height: 260px;
  overflow: auto;
  margin: 0;
  padding: var(--s-3);
  border-radius: var(--r-md);
  background: var(--color-surface-2);
  color: var(--color-text);
  font: 0.8125rem/1.5 var(--font-mono);
  white-space: pre-wrap;
}
</style>

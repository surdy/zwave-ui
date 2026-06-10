<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import type { ZwaveNode } from '@/api'
import { deviceName, deviceStatus } from '@/devices/model'

const props = defineProps<{
  nodes: ZwaveNode[]
  neighbors: Record<number, readonly number[]>
  busyNode?: number | null
}>()

const emit = defineEmits<{
  discover: [nodeId: number]
}>()

function countFor(id: number): number {
  return props.neighbors[id]?.length ?? props.nodes.find((node) => node.id === id)?.neighbors?.length ?? 0
}
</script>

<template>
  <div class="node-stat-list">
    <div v-for="node in nodes" :key="node.id" class="node-row">
      <RouterLink class="node-row__main" :to="{ name: 'device-detail', params: { id: node.id } }">
        <b>{{ deviceName(node) }}</b>
        <span>Node {{ node.id }} · {{ countFor(node.id) }} neighbors</span>
      </RouterLink>
      <BaseBadge :variant="deviceStatus(node) === 'ready' ? 'success' : deviceStatus(node) === 'asleep' ? 'warning' : deviceStatus(node) === 'unknown' ? 'neutral' : 'danger'" size="sm">
        {{ deviceStatus(node) }}
      </BaseBadge>
      <BaseButton
        variant="secondary"
        size="sm"
        :loading="busyNode === node.id"
        :disabled="node.isControllerNode"
        @click="emit('discover', node.id)"
      >
        Discover
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.node-stat-list {
  display: grid;
  gap: var(--s-2);
}
.node-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
}
.node-row__main {
  display: grid;
  gap: var(--s-1);
  min-width: 0;
  color: var(--color-text);
  text-decoration: none;
}
.node-row__main span {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
@media (max-width: 640px) {
  .node-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .node-row :deep(.btn) {
    grid-column: 1 / -1;
  }
}
</style>

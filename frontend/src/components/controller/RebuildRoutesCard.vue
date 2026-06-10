<script setup lang="ts">
import { computed } from 'vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import { rebuildPercent, type RebuildProgressState } from '@/network/controller-maintenance'

const props = defineProps<{
  progress: RebuildProgressState
  disabled?: boolean
  loading?: boolean
  stopping?: boolean
}>()

const emit = defineEmits<{
  start: []
  stop: []
}>()

const percent = computed(() => rebuildPercent(props.progress))
const nodes = computed(() => Object.values(props.progress.nodes).sort((a, b) => a.nodeId - b.nodeId))
const running = computed(() => props.progress.phase === 'running')
const dot = computed(() => {
  if (props.progress.phase === 'complete') return 'ok'
  if (props.progress.phase === 'error') return 'danger'
  if (props.progress.phase === 'running') return 'info'
  if (props.progress.phase === 'stopped') return 'warn'
  return 'idle'
})
</script>

<template>
  <BaseCard class="maintenance-card">
    <template #header>
      <div class="card-title">
        <span>Rebuild all routes</span>
        <BaseBadge variant="expert">Expert</BaseBadge>
      </div>
    </template>

    <p class="muted">
      Rebuilds routes for the whole network. Battery devices may be skipped until awake and routing can be disrupted while this runs.
    </p>

    <div class="progress-head">
      <span><StatusDot :status="dot" :pulse="running" /> {{ progress.phase }}</span>
      <strong>{{ percent }}%</strong>
    </div>
    <div class="progress"><span :style="{ width: `${percent}%` }" /></div>
    <p class="muted">{{ progress.done }} of {{ progress.total || nodes.length }} node statuses complete.</p>

    <ul v-if="nodes.length" class="node-list">
      <li v-for="node in nodes" :key="node.nodeId">
        <span>Node {{ node.nodeId }}</span>
        <BaseBadge :variant="node.status === 'done' ? 'success' : node.status === 'failed' ? 'danger' : node.status === 'skipped' ? 'warning' : 'neutral'">
          {{ node.status }}
        </BaseBadge>
      </li>
    </ul>
    <EmptyState v-else icon="🧭" title="No rebuild progress yet" description="Start a rebuild to see live per-node statuses." />

    <template #footer>
      <div class="actions">
        <BaseButton variant="danger" :loading="loading" :disabled="disabled || running" @click="emit('start')">Start rebuild</BaseButton>
        <BaseButton variant="secondary" :loading="stopping" :disabled="disabled || !running" @click="emit('stop')">Stop</BaseButton>
      </div>
    </template>
  </BaseCard>
</template>

<style scoped>
.maintenance-card,
.node-list {
  min-width: 0;
}
.card-title,
.progress-head,
.actions,
.node-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
}
.muted {
  margin: 0 0 var(--s-4);
  color: var(--color-text-muted);
}
.progress-head span {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  text-transform: capitalize;
}
.progress {
  height: 10px;
  overflow: hidden;
  background: var(--color-surface-2);
  border-radius: var(--r-pill);
  margin: var(--s-3) 0;
}
.progress span {
  display: block;
  height: 100%;
  background: var(--color-primary);
  border-radius: inherit;
}
.node-list {
  display: grid;
  gap: var(--s-2);
  margin: var(--s-4) 0 0;
  padding: 0;
  list-style: none;
}
.node-list li {
  padding: var(--s-3);
  background: var(--color-surface-2);
  border-radius: var(--r-md);
}
.actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>

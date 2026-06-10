<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BaseBadge from '@/components/base/BaseBadge.vue'
import type { MeshGraph } from '@/network/health'

defineProps<{
  graph: MeshGraph
  graphLibraryAvailable: boolean
}>()
</script>

<template>
  <div class="mesh-map">
    <div class="mesh-map__notice">
      <BaseBadge variant="info" size="sm">List fallback</BaseBadge>
      <span v-if="!graphLibraryAvailable">vis-network is not installed, so the mobile-friendly topology list is used.</span>
      <span v-else>The interactive graph is lazy-loaded on larger screens; this list remains the mobile fallback.</span>
    </div>

    <div class="mesh-map__list">
      <RouterLink
        v-for="node in graph.nodes"
        :key="node.id"
        class="mesh-node"
        :to="{ name: 'device-detail', params: { id: node.id } }"
      >
        <span class="mesh-node__dot" :style="{ background: node.color }" />
        <span class="mesh-node__label">{{ node.label }}</span>
        <BaseBadge :variant="node.group === 'controller' ? 'primary' : node.status === 'ready' ? 'success' : node.status === 'asleep' ? 'warning' : node.status === 'unknown' ? 'neutral' : 'danger'" size="sm">
          {{ node.group === 'controller' ? 'controller' : node.status }}
        </BaseBadge>
        <small>{{ graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id).length }} links</small>
      </RouterLink>
    </div>

    <div class="mesh-map__edges" aria-label="Neighbor links">
      <span v-for="edge in graph.edges" :key="edge.id">{{ edge.from }} ↔ {{ edge.to }}</span>
      <span v-if="graph.edges.length === 0">No neighbor links loaded yet.</span>
    </div>
  </div>
</template>

<style scoped>
.mesh-map,
.mesh-map__list,
.mesh-map__edges {
  display: grid;
  gap: var(--s-3);
}
.mesh-map__notice {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  align-items: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
.mesh-node {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  color: var(--color-text);
  text-decoration: none;
}
.mesh-node:hover { background: var(--color-surface-2); }
.mesh-node__dot {
  width: 12px;
  height: 12px;
  border-radius: var(--r-pill);
}
.mesh-node__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mesh-node small,
.mesh-map__edges {
  color: var(--color-text-muted);
}
.mesh-map__edges {
  display: flex;
  flex-wrap: wrap;
  font-size: 0.8125rem;
}
.mesh-map__edges span {
  padding: var(--s-1) var(--s-2);
  border-radius: var(--r-pill);
  background: var(--color-surface-2);
}
@media (max-width: 640px) {
  .mesh-node {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .mesh-node small {
    grid-column: 2 / -1;
  }
}
</style>

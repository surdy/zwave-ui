<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseBadge from '@/components/base/BaseBadge.vue'
import type { GraphNode, MeshGraph } from '@/network/health'

const props = defineProps<{
  graph: MeshGraph
  graphLibraryAvailable: boolean
}>()

const router = useRouter()

const VIEWBOX = 100
const CENTER = VIEWBOX / 2
const RING = 38

/** Deterministic radial layout: controller at the center, others on a ring. */
const positions = computed(() => {
  const map = new Map<number, { x: number; y: number }>()
  const ring = props.graph.nodes.filter((node) => node.group !== 'controller')
  const controller = props.graph.nodes.find((node) => node.group === 'controller')
  if (controller) map.set(controller.id, { x: CENTER, y: CENTER })
  const count = ring.length || 1
  ring.forEach((node, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2
    map.set(node.id, {
      x: CENTER + Math.cos(angle) * RING,
      y: CENTER + Math.sin(angle) * RING,
    })
  })
  return map
})

const edgeLines = computed(() =>
  props.graph.edges
    .map((edge) => {
      const from = positions.value.get(edge.from)
      const to = positions.value.get(edge.to)
      return from && to ? { id: edge.id, x1: from.x, y1: from.y, x2: to.x, y2: to.y } : null
    })
    .filter((line): line is { id: string; x1: number; y1: number; x2: number; y2: number } => line !== null),
)

const placedNodes = computed(() =>
  props.graph.nodes.map((node) => ({ node, pos: positions.value.get(node.id) ?? { x: CENTER, y: CENTER } })),
)

function linkCount(id: number): number {
  return props.graph.edges.filter((edge) => edge.from === id || edge.to === id).length
}

function badgeVariant(node: GraphNode): 'primary' | 'success' | 'warning' | 'neutral' | 'danger' {
  if (node.group === 'controller') return 'primary'
  if (node.status === 'ready') return 'success'
  if (node.status === 'asleep') return 'warning'
  if (node.status === 'unknown') return 'neutral'
  return 'danger'
}

function open(id: number) {
  router.push({ name: 'device-detail', params: { id } })
}
</script>

<template>
  <div class="mesh-map">
    <!-- Interactive topology (larger screens). Self-contained SVG — no graph lib. -->
    <div class="mesh-map__graph" role="group" aria-label="Mesh topology">
      <svg :viewBox="`0 0 ${VIEWBOX} ${VIEWBOX}`" preserveAspectRatio="xMidYMid meet">
        <line
          v-for="line in edgeLines"
          :key="line.id"
          class="edge"
          :x1="line.x1"
          :y1="line.y1"
          :x2="line.x2"
          :y2="line.y2"
        />
        <g
          v-for="{ node, pos } in placedNodes"
          :key="node.id"
          class="node"
          :class="{ 'node--controller': node.group === 'controller' }"
          role="button"
          tabindex="0"
          @click="open(node.id)"
          @keydown.enter="open(node.id)"
          @keydown.space.prevent="open(node.id)"
        >
          <title>{{ node.title }} · {{ linkCount(node.id) }} links</title>
          <circle :cx="pos.x" :cy="pos.y" :r="node.group === 'controller' ? 4.6 : 3.4" :style="{ fill: node.color }" />
          <text :x="pos.x" :y="pos.y" class="node__id" dy="0.35em">{{ node.id }}</text>
        </g>
      </svg>
      <ul class="legend" aria-hidden="true">
        <li><span class="legend__dot" style="background: var(--color-primary)" />Controller</li>
        <li><span class="legend__dot" style="background: var(--ok)" />Ready</li>
        <li><span class="legend__dot" style="background: var(--warn)" />Asleep</li>
        <li><span class="legend__dot" style="background: var(--danger)" />Dead/failed</li>
      </ul>
    </div>

    <!-- Accessible list / mobile fallback. -->
    <div class="mesh-map__list">
      <p class="mesh-map__notice">
        <BaseBadge v-if="!graphLibraryAvailable" variant="info" size="sm">List view</BaseBadge>
        <span>Tap a node to open its details. The diagram above appears on larger screens.</span>
      </p>
      <button
        v-for="node in graph.nodes"
        :key="node.id"
        type="button"
        class="mesh-node"
        @click="open(node.id)"
      >
        <span class="mesh-node__dot" :style="{ background: node.color }" />
        <span class="mesh-node__label">{{ node.label }}</span>
        <BaseBadge :variant="badgeVariant(node)" size="sm">
          {{ node.group === 'controller' ? 'controller' : node.status }}
        </BaseBadge>
        <small>{{ linkCount(node.id) }} links</small>
      </button>
      <p v-if="graph.edges.length === 0" class="mesh-map__empty">No neighbor links loaded yet — refresh neighbors to map the mesh.</p>
    </div>
  </div>
</template>

<style scoped>
.mesh-map {
  display: grid;
  gap: var(--s-4);
}

/* ---------- SVG graph ---------- */
.mesh-map__graph {
  position: relative;
  display: none;
}
.mesh-map__graph svg {
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
  max-height: 460px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
}
.edge {
  stroke: var(--color-border);
  stroke-width: 0.5;
}
.node {
  cursor: pointer;
}
.node circle {
  stroke: var(--color-surface);
  stroke-width: 0.6;
  transition: r 0.12s ease;
}
.node:hover circle,
.node:focus-visible circle {
  stroke: var(--color-primary);
  stroke-width: 1;
}
.node:focus-visible {
  outline: none;
}
.node__id {
  fill: #fff;
  font-size: 2.6px;
  font-weight: 700;
  text-anchor: middle;
  pointer-events: none;
  paint-order: stroke;
}
.node--controller .node__id {
  font-size: 3px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
  list-style: none;
  margin: var(--s-3) 0 0;
  padding: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
}
.legend__dot {
  width: 10px;
  height: 10px;
  border-radius: var(--r-pill);
}

/* ---------- List / fallback ---------- */
.mesh-map__list {
  display: grid;
  gap: var(--s-2);
}
.mesh-map__notice {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  align-items: center;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
.mesh-node {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--s-3);
  width: 100%;
  padding: var(--s-3);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.mesh-node:hover {
  background: var(--color-surface-2);
}
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
.mesh-map__empty {
  color: var(--color-text-muted);
}
.mesh-map__empty {
  margin: 0;
  font-size: 0.875rem;
}

@media (min-width: 640px) {
  .mesh-map__graph {
    display: block;
  }
}
@media (max-width: 640px) {
  .mesh-node {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .mesh-node small {
    grid-column: 2 / -1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .node circle {
    transition: none;
  }
}
</style>

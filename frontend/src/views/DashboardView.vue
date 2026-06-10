<script setup lang="ts">
/**
 * Dashboard placeholder. The full glanceable dashboard (favorites, rooms, needs
 * attention) lands in #7 — for now this surfaces the live connection + node
 * readout so the realtime layer and shell are verifiable end to end.
 */
import { storeToRefs } from 'pinia'
import { useControllerStore } from '@/stores/controller'
import { useNodesStore } from '@/stores/nodes'

const controller = useControllerStore()
const nodes = useNodesStore()
const { status, info } = storeToRefs(controller)
</script>

<template>
  <section class="dash">
    <dl class="dash__stats">
      <div class="dash__stat">
        <dt>Connection</dt>
        <dd :data-status="status">{{ status }}</dd>
      </div>
      <div class="dash__stat">
        <dt>App version</dt>
        <dd>{{ info?.appVersion ?? '—' }}</dd>
      </div>
      <div class="dash__stat">
        <dt>Devices</dt>
        <dd>{{ nodes.count }}</dd>
      </div>
    </dl>

    <ul v-if="nodes.list.length" class="dash__nodes">
      <li v-for="node in nodes.list" :key="node.id">
        <span class="dash__node-id">#{{ node.id }}</span>
        <span class="dash__node-name">
          {{ node.name || node.productLabel || 'Unknown device' }}
        </span>
        <span class="dash__node-status">{{ node.status ?? '' }}</span>
      </li>
    </ul>

    <p class="dash__note">The full dashboard arrives in #7.</p>
  </section>
</template>

<style scoped>
.dash {
  display: grid;
  gap: var(--s-4);
  max-width: 720px;
}
.dash__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-3);
  margin: 0;
}
.dash__stat {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  padding: var(--s-4);
}
.dash__stat dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}
.dash__stat dd {
  margin: var(--s-1) 0 0;
  font-weight: 600;
  font-size: 1.125rem;
  text-transform: capitalize;
}
.dash__stat dd[data-status='connected'] {
  color: var(--ok);
}
.dash__stat dd[data-status='error'],
.dash__stat dd[data-status='disconnected'] {
  color: var(--danger);
}
.dash__nodes {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: var(--s-2);
}
.dash__nodes li {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
}
.dash__node-id {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}
.dash__node-status {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.dash__note {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
</style>

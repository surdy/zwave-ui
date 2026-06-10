<script setup lang="ts">
/**
 * Associations tab (Advanced). Placeholder — full implementation tracked in #12
 * (association groups: list/add/remove targets, lifeline handling).
 */
import type { ZwaveNode } from '@/api'

defineProps<{ node: ZwaveNode }>()
</script>

<template>
  <section class="tabpanel">
    <article class="tab-placeholder">
      <h2>Associations</h2>
      <p class="muted">Association group management will be implemented in #12.</p>
    </article>
  </section>
</template>

<style scoped>
.tabpanel {
  display: grid;
  gap: var(--s-4);
}
.tab-placeholder {
  padding: var(--s-5);
  border: 1px dashed var(--color-border);
  border-radius: var(--r-lg);
  background: var(--color-surface);
}
.tab-placeholder h2 {
  margin: 0 0 var(--s-2);
}
.muted {
  color: var(--color-text-muted);
  margin: 0;
}
</style>

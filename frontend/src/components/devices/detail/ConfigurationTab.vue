<script setup lang="ts">
/**
 * Configuration parameters tab (Advanced). Placeholder — full implementation
 * tracked in #11 (config CC parameter editor driven by value metadata).
 */
import type { ZwaveNode } from '@/api'

defineProps<{ node: ZwaveNode }>()
</script>

<template>
  <section class="tabpanel">
    <article class="tab-placeholder">
      <h2>Configuration</h2>
      <p class="muted">Device configuration parameters will be implemented in #11.</p>
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

<script setup lang="ts">
/**
 * Activity & node maintenance tab (Advanced). Placeholder — full implementation
 * tracked in #14 (events/activity log + maintenance actions like ping, heal,
 * refresh info, interview, remove failed).
 */
import type { ZwaveNode } from '@/api'

defineProps<{ node: ZwaveNode }>()
</script>

<template>
  <section class="tabpanel">
    <article class="tab-placeholder">
      <h2>Activity &amp; maintenance</h2>
      <p class="muted">Activity log and node maintenance will be implemented in #14.</p>
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

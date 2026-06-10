<script setup lang="ts">
/**
 * Firmware update tab (Expert). Placeholder — full implementation tracked in #13
 * (OTA firmware update flow with progress + safety warnings).
 */
import type { ZwaveNode } from '@/api'

defineProps<{ node: ZwaveNode }>()
</script>

<template>
  <section class="tabpanel">
    <article class="tab-placeholder">
      <h2>Firmware</h2>
      <p class="muted">OTA firmware updates will be implemented in #13.</p>
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

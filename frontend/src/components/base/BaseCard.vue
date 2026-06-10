<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Removes inner padding (for media/edge-to-edge content). */
    flush?: boolean
    /** Raises the card with a stronger shadow. */
    elevated?: boolean
  }>(),
  { flush: false, elevated: false },
)
</script>

<template>
  <section class="card" :class="{ 'card--flush': flush, 'card--elevated': elevated }">
    <header v-if="$slots.header" class="card__header">
      <slot name="header" />
    </header>
    <div class="card__body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-1);
  overflow: hidden;
}
.card--elevated {
  box-shadow: var(--shadow-2);
}
.card__header {
  padding: var(--s-4) var(--s-5);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
}
.card__body {
  padding: var(--s-5);
}
.card--flush .card__body {
  padding: 0;
}
.card__footer {
  padding: var(--s-4) var(--s-5);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-2);
}
</style>

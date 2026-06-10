<script setup lang="ts">
withDefaults(
  defineProps<{
    /** CSS width, e.g. '100%', '8rem'. */
    width?: string
    /** CSS height, e.g. '1rem'. */
    height?: string
    /** Shape of the placeholder. */
    variant?: 'text' | 'rect' | 'circle'
  }>(),
  { width: '100%', height: '1rem', variant: 'text' },
)
</script>

<template>
  <span
    class="skeleton"
    :class="`skeleton--${variant}`"
    :style="{ width, height }"
    aria-hidden="true"
  />
</template>

<style scoped>
.skeleton {
  display: block;
  background: linear-gradient(
    90deg,
    var(--color-surface-2) 25%,
    var(--color-border) 37%,
    var(--color-surface-2) 63%
  );
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
  border-radius: var(--r-sm);
}
.skeleton--text {
  border-radius: var(--r-sm);
}
.skeleton--rect {
  border-radius: var(--r-md);
}
.skeleton--circle {
  border-radius: 50%;
}
@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}
</style>

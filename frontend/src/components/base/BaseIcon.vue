<script setup lang="ts">
/**
 * Inline SVG icon set (stroke uses currentColor). Keeps the bundle dependency
 * free; add new 24x24 stroke paths to the map as needed.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number | string
  }>(),
  { size: 22 },
)

const paths: Record<string, string> = {
  dashboard: 'M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z',
  devices:
    'M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 14h.01',
  add: 'M12 5v14M5 12h14',
  network: 'M12 3v6m0 6v6M5.6 7.6 9 11m6 2 3.4 3.4M18.4 7.6 15 11m-6 2-3.4 3.4',
  settings: 'M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4M6 16v4',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.42-1.42M4.92 19.08l1.42-1.42m0-11.32L4.92 4.92m14.16 14.16-1.42-1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  monitor: 'M3 4h18v12H3z M8 20h8 M12 16v4',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71m-1.75 4.82a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  close: 'M18 6 6 18M6 6l12 12',
}

const d = computed(() => paths[props.name] ?? '')
const dimension = computed(() =>
  typeof props.size === 'number' ? `${props.size}px` : props.size,
)
</script>

<template>
  <svg
    :width="dimension"
    :height="dimension"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="icon"
  >
    <path :d="d" />
  </svg>
</template>

<style scoped>
.icon {
  flex: none;
  display: block;
}
</style>

<script setup lang="ts">
/**
 * Renders its slot only when advanced (or expert) disclosure is enabled.
 * The primary mechanism for the 3-tier progressive-disclosure model.
 */
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'

const props = withDefaults(
  defineProps<{
    /** Render inline (default) or as a block wrapper. */
    tag?: string
  }>(),
  { tag: 'div' },
)

const ui = useUiStore()
const show = computed(() => ui.advanced)
// reference props.tag explicitly for the template
const tag = computed(() => props.tag)
</script>

<template>
  <component :is="tag" v-if="show" class="advanced-only">
    <slot />
  </component>
</template>

<style scoped>
.advanced-only {
  display: contents;
}
</style>

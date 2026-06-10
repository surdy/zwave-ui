<script setup lang="ts">
/**
 * Connection status indicator driven by the controller store. Maps the realtime
 * connection lifecycle onto a colored dot + label.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useControllerStore } from '@/stores/controller'
import StatusDot from '@/components/base/StatusDot.vue'

const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const controller = useControllerStore()
const { status } = storeToRefs(controller)

type DotStatus = 'ok' | 'warn' | 'danger' | 'info' | 'idle'

const view = computed<{ dot: DotStatus; label: string; pulse: boolean }>(() => {
  switch (status.value) {
    case 'connected':
      return { dot: 'ok', label: 'Connected', pulse: false }
    case 'connecting':
      return { dot: 'info', label: 'Connecting…', pulse: true }
    case 'reconnecting':
      return { dot: 'warn', label: 'Reconnecting…', pulse: true }
    case 'error':
      return { dot: 'danger', label: 'Disconnected', pulse: false }
    case 'disconnected':
      return { dot: 'idle', label: 'Offline', pulse: false }
    default:
      return { dot: 'idle', label: 'Idle', pulse: false }
  }
})
</script>

<template>
  <span
    class="conn"
    :class="{ 'conn--compact': props.compact }"
    :title="view.label"
    role="status"
    :aria-label="`Backend ${view.label}`"
  >
    <StatusDot :status="view.dot" :pulse="view.pulse" :label="view.label" />
    <span v-if="!props.compact" class="conn__label">{{ view.label }}</span>
  </span>
</template>

<style scoped>
.conn {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  font-size: 0.875rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.conn__label {
  font-weight: 500;
}
</style>

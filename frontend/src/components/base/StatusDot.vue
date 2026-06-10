<script setup lang="ts">
withDefaults(
  defineProps<{
    status?: 'ok' | 'warn' | 'danger' | 'info' | 'idle'
    pulse?: boolean
    label?: string
  }>(),
  { status: 'idle', pulse: false },
)
</script>

<template>
  <span
    class="dot"
    :class="[`dot--${status}`, { 'dot--pulse': pulse }]"
    role="img"
    :aria-label="label ?? status"
  />
</template>

<style scoped>
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex: none;
}
.dot--ok {
  background: var(--ok);
}
.dot--warn {
  background: var(--warn);
}
.dot--danger {
  background: var(--danger);
}
.dot--info {
  background: var(--info);
}
.dot--idle {
  background: var(--color-text-muted);
}
.dot--pulse {
  box-shadow: 0 0 0 0 currentColor;
  animation: dot-pulse 1.8s infinite;
  color: inherit;
}
.dot--ok.dot--pulse {
  animation-name: dot-pulse-ok;
}
@keyframes dot-pulse-ok {
  0% {
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(22, 163, 74, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
  }
}
@keyframes dot-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(100, 116, 139, 0.4);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(100, 116, 139, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(100, 116, 139, 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .dot--pulse {
    animation: none;
  }
}
</style>

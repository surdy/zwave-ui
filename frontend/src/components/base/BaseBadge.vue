<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'advanced' | 'expert'
    size?: 'sm' | 'md'
  }>(),
  { variant: 'neutral', size: 'md' },
)
</script>

<template>
  <span class="badge" :class="[`badge--${variant}`, `badge--${size}`]">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
  border-radius: var(--r-pill);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.badge--sm {
  padding: 2px var(--s-2);
  font-size: 0.6875rem;
}
.badge--md {
  padding: 4px var(--s-3);
  font-size: 0.75rem;
}

.badge--neutral {
  background: var(--color-surface-2);
  color: var(--color-text-muted);
}
.badge--primary {
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
}
.badge--success {
  background: var(--ok-soft);
  color: var(--ok);
}
.badge--warning {
  background: var(--warn-soft);
  color: var(--warn);
}
.badge--danger {
  background: var(--danger-soft);
  color: var(--danger);
}
.badge--info {
  background: var(--info-soft);
  color: var(--info);
}
/* Tier badges for the progressive-disclosure model */
.badge--advanced {
  background: var(--info-soft);
  color: var(--info);
}
.badge--expert {
  background: var(--danger-soft);
  color: var(--danger);
}
</style>

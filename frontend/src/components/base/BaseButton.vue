<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    block?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
    loading: false,
    block: false,
  },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block, 'btn--loading': loading }]"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <span class="btn__label"><slot /></span>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  border: 1px solid transparent;
  border-radius: var(--r-md);
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
  white-space: nowrap;
}
.btn--sm {
  padding: var(--s-2) var(--s-3);
  font-size: 0.8125rem;
}
.btn--md {
  padding: var(--s-3) var(--s-4);
  font-size: 0.9375rem;
}
.btn--lg {
  padding: var(--s-4) var(--s-5);
  font-size: 1rem;
}
.btn--block {
  width: 100%;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--color-primary);
  color: #fff;
}
.btn--primary:not(:disabled):hover {
  background: var(--color-primary-strong);
}
.btn--secondary {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}
.btn--secondary:not(:disabled):hover {
  background: var(--color-surface-2);
}
.btn--ghost {
  background: transparent;
  color: var(--color-text);
}
.btn--ghost:not(:disabled):hover {
  background: var(--color-surface-2);
}
.btn--danger {
  background: var(--danger);
  color: #fff;
}
.btn--danger:not(:disabled):hover {
  filter: brightness(0.92);
}

.btn__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: btn-spin 0.6s linear infinite;
}
@keyframes btn-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .btn,
  .btn__spinner {
    transition: none;
    animation-duration: 1.5s;
  }
}
</style>

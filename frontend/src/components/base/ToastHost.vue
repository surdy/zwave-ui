<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

const icons: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" role="region" aria-label="Notifications" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="`toast--${t.type}`"
          role="status"
        >
          <span class="toast__icon" aria-hidden="true">{{ icons[t.type] }}</span>
          <div class="toast__body">
            <p v-if="t.title" class="toast__title">{{ t.title }}</p>
            <p class="toast__msg">{{ t.message }}</p>
          </div>
          <button class="toast__close" type="button" aria-label="Dismiss" @click="dismiss(t.id)">
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  z-index: 1000;
  bottom: var(--s-4);
  right: var(--s-4);
  left: var(--s-4);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--s-2);
  pointer-events: none;
}
@media (min-width: 640px) {
  .toast-host {
    left: auto;
    max-width: 400px;
  }
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  width: 100%;
  padding: var(--s-3) var(--s-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left-width: 4px;
  border-radius: var(--r-md);
  box-shadow: var(--shadow-2);
}
.toast--success {
  border-left-color: var(--ok);
}
.toast--error {
  border-left-color: var(--danger);
}
.toast--warning {
  border-left-color: var(--warn);
}
.toast--info {
  border-left-color: var(--info);
}
.toast__icon {
  flex: none;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
}
.toast--success .toast__icon {
  background: var(--ok);
}
.toast--error .toast__icon {
  background: var(--danger);
}
.toast--warning .toast__icon {
  background: var(--warn);
}
.toast--info .toast__icon {
  background: var(--info);
}
.toast__body {
  flex: 1;
  min-width: 0;
}
.toast__title {
  margin: 0;
  font-weight: 600;
  font-size: 0.9375rem;
}
.toast__msg {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  word-break: break-word;
}
.toast__close {
  flex: none;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  padding: 2px;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>

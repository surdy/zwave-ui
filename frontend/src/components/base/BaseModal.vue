<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    title?: string
    size?: 'sm' | 'md' | 'lg'
    /** When true, clicking the backdrop / pressing Escape does not close. */
    persistent?: boolean
  }>(),
  { size: 'md', persistent: false },
)

const emit = defineEmits<{ close: [] }>()

const dialogRef = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

function close() {
  if (props.persistent) return
  open.value = false
  emit('close')
}

function onBackdrop() {
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
    return
  }
  if (e.key === 'Tab') trapFocus(e)
}

function focusable(): HTMLElement[] {
  if (!dialogRef.value) return []
  return Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ),
  )
}

function trapFocus(e: KeyboardEvent) {
  const items = focusable()
  if (items.length === 0) return
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement as HTMLElement
  if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(open, async (isOpen) => {
  if (isOpen) {
    lastFocused = document.activeElement as HTMLElement
    await nextTick()
    const items = focusable()
    ;(items[0] ?? dialogRef.value)?.focus()
  } else {
    lastFocused?.focus?.()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal" @keydown="onKeydown">
        <div class="modal__backdrop" @click="onBackdrop" />
        <div
          ref="dialogRef"
          class="modal__dialog"
          :class="`modal__dialog--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <header v-if="title || $slots.header" class="modal__header">
            <slot name="header">
              <h2 class="modal__title">{{ title }}</h2>
            </slot>
            <button
              v-if="!persistent"
              class="modal__close"
              type="button"
              aria-label="Close"
              @click="close"
            >
              ✕
            </button>
          </header>
          <div class="modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: grid;
  place-items: center;
  padding: var(--s-4);
}
.modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(2, 6, 23, 0.5);
}
.modal__dialog {
  position: relative;
  width: 100%;
  max-height: calc(100vh - var(--s-6));
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-2);
  overflow: hidden;
}
.modal__dialog--sm {
  max-width: 420px;
}
.modal__dialog--md {
  max-width: 560px;
}
.modal__dialog--lg {
  max-width: 760px;
}
.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: var(--s-4) var(--s-5);
  border-bottom: 1px solid var(--color-border);
}
.modal__title {
  margin: 0;
  font-size: 1.0625rem;
}
.modal__close {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1rem;
  padding: var(--s-1);
}
.modal__body {
  padding: var(--s-5);
  overflow-y: auto;
}
.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--s-2);
  padding: var(--s-4) var(--s-5);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-2);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .modal__dialog,
.modal-leave-active .modal__dialog {
  transition: transform 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal__dialog,
.modal-leave-to .modal__dialog {
  transform: translateY(12px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active,
  .modal-enter-active .modal__dialog,
  .modal-leave-active .modal__dialog {
    transition: none;
  }
}
</style>

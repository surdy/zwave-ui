/**
 * Global toast notifications. `useToast()` can be called from anywhere; the
 * single <ToastHost> mounted in the app shell renders the queue.
 */
import { reactive, readonly } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  type: ToastType
  message: string
  title?: string
  timeout: number
}

export interface ToastOptions {
  title?: string
  /** Auto-dismiss after N ms; 0 disables auto-dismiss. */
  timeout?: number
}

const toasts = reactive<Toast[]>([])
let nextId = 1

function dismiss(id: number) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i !== -1) toasts.splice(i, 1)
}

function push(type: ToastType, message: string, opts: ToastOptions = {}): number {
  const id = nextId++
  const timeout = opts.timeout ?? 5000
  toasts.push({ id, type, message, title: opts.title, timeout })
  if (timeout > 0) {
    setTimeout(() => dismiss(id), timeout)
  }
  return id
}

export function useToast() {
  return {
    toasts: readonly(toasts),
    dismiss,
    success: (message: string, opts?: ToastOptions) => push('success', message, opts),
    error: (message: string, opts?: ToastOptions) => push('error', message, { timeout: 8000, ...opts }),
    warning: (message: string, opts?: ToastOptions) => push('warning', message, opts),
    info: (message: string, opts?: ToastOptions) => push('info', message, opts),
  }
}

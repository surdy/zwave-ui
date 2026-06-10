/**
 * Global confirmation / prompt dialogs. `useConfirm()` works from anywhere; the
 * single <ConfirmHost> mounted in the app shell renders the active request.
 *
 *   const { confirm, prompt } = useConfirm()
 *   if (await confirm({ title: 'Remove node?', danger: true })) { ... }
 *   const name = await prompt({ title: 'Rename', input: { type: 'text' } })
 */
import { reactive, readonly } from 'vue'
import type { SelectOption } from '@/components/base/BaseSelect.vue'

export type ConfirmInputType = 'text' | 'number' | 'boolean' | 'select'

export interface ConfirmInput {
  type: ConfirmInputType
  label?: string
  placeholder?: string
  default?: string | number | boolean
  options?: SelectOption[]
}

export interface ConfirmOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  input?: ConfirmInput
}

export interface ConfirmResult {
  confirmed: boolean
  value?: string | number | boolean
}

interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'input'>> {
  id: number
  input?: ConfirmInput
  resolve: (result: ConfirmResult) => void
}

const queue = reactive<ConfirmRequest[]>([])
let nextId = 1

function open(opts: ConfirmOptions): Promise<ConfirmResult> {
  return new Promise((resolve) => {
    queue.push({
      id: nextId++,
      title: opts.title ?? 'Are you sure?',
      message: opts.message ?? '',
      confirmText: opts.confirmText ?? 'Confirm',
      cancelText: opts.cancelText ?? 'Cancel',
      danger: opts.danger ?? false,
      input: opts.input,
      resolve,
    })
  })
}

function settle(id: number, result: ConfirmResult) {
  const i = queue.findIndex((r) => r.id === id)
  if (i === -1) return
  const [req] = queue.splice(i, 1)
  req.resolve(result)
}

export function useConfirm() {
  return {
    /** Active request queue (host-internal). */
    queue: readonly(queue),
    settle,
    /** Yes/no confirmation. Resolves true when confirmed. */
    confirm: (opts: ConfirmOptions = {}): Promise<boolean> =>
      open(opts).then((r) => r.confirmed),
    /** Prompt for a value. Resolves the value, or null when cancelled. */
    prompt: (
      opts: ConfirmOptions & { input: ConfirmInput },
    ): Promise<string | number | boolean | null> =>
      open(opts).then((r) => (r.confirmed ? (r.value ?? null) : null)),
    /** Low-level open returning the full result. */
    open,
  }
}

<script setup lang="ts">
import { useId } from 'vue'

export interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

const model = defineModel<string | number>({ default: '' })

withDefaults(
  defineProps<{
    label?: string
    options: readonly SelectOption[]
    hint?: string
    error?: string
    disabled?: boolean
    placeholder?: string
  }>(),
  { disabled: false },
)

const id = useId()
</script>

<template>
  <div class="field" :class="{ 'field--error': error }">
    <label v-if="label" :for="id" class="field__label">{{ label }}</label>
    <div class="field__wrap">
      <select
        :id="id"
        v-model="model"
        class="field__input"
        :disabled="disabled"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="hint || error ? `${id}-desc` : undefined"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option
          v-for="opt in options"
          :key="String(opt.value)"
          :value="opt.value"
          :disabled="opt.disabled"
        >
          {{ opt.label }}
        </option>
      </select>
      <span class="field__chevron" aria-hidden="true">▾</span>
    </div>
    <p v-if="error || hint" :id="`${id}-desc`" class="field__desc">{{ error || hint }}</p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.field__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}
.field__wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.field__input {
  width: 100%;
  padding: var(--s-3);
  padding-right: var(--s-6);
  font: inherit;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  appearance: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.field__input:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}
.field__input:disabled {
  background: var(--color-surface-2);
  cursor: not-allowed;
}
.field__chevron {
  position: absolute;
  right: var(--s-3);
  color: var(--color-text-muted);
  pointer-events: none;
}
.field--error .field__input {
  border-color: var(--danger);
}
.field__desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}
.field--error .field__desc {
  color: var(--danger);
}
</style>

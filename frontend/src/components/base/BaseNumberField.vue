<script setup lang="ts">
import { useId } from 'vue'

const model = defineModel<number | null>({ default: null })

withDefaults(
  defineProps<{
    label?: string
    min?: number
    max?: number
    step?: number
    placeholder?: string
    hint?: string
    error?: string
    disabled?: boolean
    unit?: string
  }>(),
  { disabled: false },
)

const id = useId()
</script>

<template>
  <div class="field" :class="{ 'field--error': error }">
    <label v-if="label" :for="id" class="field__label">{{ label }}</label>
    <div class="field__wrap">
      <input
        :id="id"
        v-model.number="model"
        type="number"
        class="field__input"
        :min="min"
        :max="max"
        :step="step"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="hint || error ? `${id}-desc` : undefined"
        inputmode="decimal"
      />
      <span v-if="unit" class="field__unit">{{ unit }}</span>
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
  font: inherit;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
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
.field__unit {
  position: absolute;
  right: var(--s-3);
  color: var(--color-text-muted);
  font-size: 0.875rem;
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

<script setup lang="ts">
import { useId } from 'vue'

const model = defineModel<string>({ default: '' })

withDefaults(
  defineProps<{
    label?: string
    type?: 'text' | 'password' | 'email' | 'search' | 'url'
    placeholder?: string
    hint?: string
    error?: string
    disabled?: boolean
    required?: boolean
    autocomplete?: string
  }>(),
  { type: 'text', disabled: false, required: false },
)

const id = useId()
</script>

<template>
  <div class="field" :class="{ 'field--error': error }">
    <label v-if="label" :for="id" class="field__label">
      {{ label }}<span v-if="required" class="field__req" aria-hidden="true"> *</span>
    </label>
    <input
      :id="id"
      v-model="model"
      :type="type"
      class="field__input"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :autocomplete="autocomplete"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="hint || error ? `${id}-desc` : undefined"
    />
    <p v-if="error || hint" :id="`${id}-desc`" class="field__desc">
      {{ error || hint }}
    </p>
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
.field__req {
  color: var(--danger);
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

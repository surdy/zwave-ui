<script setup lang="ts">
const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    label?: string
    disabled?: boolean
  }>(),
  { disabled: false },
)

function toggle() {
  if (!props.disabled) model.value = !model.value
}

function onKey(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    toggle()
  }
}
</script>

<template>
  <label class="switch" :class="{ 'switch--disabled': disabled }">
    <button
      type="button"
      role="switch"
      :aria-checked="model"
      :aria-label="label"
      :disabled="disabled"
      class="switch__track"
      :class="{ 'switch__track--on': model }"
      @click="toggle"
      @keydown="onKey"
    >
      <span class="switch__thumb" />
    </button>
    <span v-if="label" class="switch__label">{{ label }}</span>
  </label>
</template>

<style scoped>
.switch {
  display: inline-flex;
  align-items: center;
  gap: var(--s-3);
  cursor: pointer;
}
.switch--disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.switch__track {
  position: relative;
  width: 44px;
  height: 26px;
  border: none;
  border-radius: var(--r-pill);
  background: var(--color-border);
  padding: 0;
  cursor: inherit;
  transition: background 0.15s ease;
  flex: none;
}
.switch__track--on {
  background: var(--color-primary);
}
.switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: var(--shadow-1);
  transition: transform 0.15s ease;
}
.switch__track--on .switch__thumb {
  transform: translateX(18px);
}
.switch__label {
  font-size: 0.9375rem;
  color: var(--color-text);
}
@media (prefers-reduced-motion: reduce) {
  .switch__track,
  .switch__thumb {
    transition: none;
  }
}
</style>

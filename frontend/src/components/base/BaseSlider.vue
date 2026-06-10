<script setup lang="ts">
const model = defineModel<number>({ default: 0 })

withDefaults(
  defineProps<{
    label?: string
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    /** Show the current value next to the label. */
    showValue?: boolean
    unit?: string
  }>(),
  { min: 0, max: 100, step: 1, disabled: false, showValue: true },
)
</script>

<template>
  <div class="slider" :class="{ 'slider--disabled': disabled }">
    <div v-if="label || showValue" class="slider__head">
      <label v-if="label" class="slider__label">{{ label }}</label>
      <span v-if="showValue" class="slider__value">{{ model }}{{ unit }}</span>
    </div>
    <input
      v-model.number="model"
      type="range"
      class="slider__input"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :aria-label="label"
    />
  </div>
</template>

<style scoped>
.slider {
  width: 100%;
}
.slider--disabled {
  opacity: 0.55;
}
.slider__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--s-2);
}
.slider__label {
  font-size: 0.9375rem;
  color: var(--color-text);
}
.slider__value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--color-primary-strong);
}
.slider__input {
  width: 100%;
  accent-color: var(--color-primary);
  cursor: pointer;
}
.slider__input:disabled {
  cursor: not-allowed;
}
</style>

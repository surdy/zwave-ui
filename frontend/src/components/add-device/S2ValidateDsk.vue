<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import type { DskRequest } from '@/devices/inclusion'

const props = defineProps<{ request: DskRequest; busy?: boolean }>()
const emit = defineEmits<{
  submit: [dsk: string]
  abort: []
}>()

const pin = ref('')
const expectedLength = computed(() => props.request.pinLength || 5)
const error = computed(() => {
  if (!pin.value) return ''
  return /^\d+$/.test(pin.value) && pin.value.length === expectedLength.value ? '' : `Enter the ${expectedLength.value}-digit PIN.`
})
const suffix = computed(() => props.request.dsk.replace(/^\d{5}-?/, ''))

watch(
  () => props.request,
  () => {
    pin.value = ''
  },
)

function submit() {
  if (error.value || !pin.value) return
  emit('submit', suffix.value ? `${pin.value}-${suffix.value}` : pin.value)
}
</script>

<template>
  <section class="s2-card" aria-labelledby="s2-dsk-title">
    <div>
      <p class="eyebrow">Secure inclusion</p>
      <h3 id="s2-dsk-title">Validate the DSK</h3>
      <p class="muted">Enter the 5-digit PIN printed on the device. Confirm the remaining DSK matches the label.</p>
    </div>

    <BaseTextField
      v-model="pin"
      label="DSK PIN"
      placeholder="12345"
      autocomplete="one-time-code"
      :disabled="busy"
      :error="error"
      :hint="suffix ? `Remaining DSK: ${suffix}` : 'Enter only the first 5 digits if the device shows a full DSK.'"
      required
    />

    <div class="actions">
      <BaseButton variant="primary" :loading="busy" :disabled="!!error || !pin" @click="submit">Validate DSK</BaseButton>
      <BaseButton variant="danger" :disabled="busy" @click="emit('abort')">Abort</BaseButton>
    </div>
  </section>
</template>

<style scoped>
.s2-card {
  display: grid;
  gap: var(--s-4);
  padding: var(--s-4);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  background: var(--color-surface);
}
.eyebrow {
  margin: 0 0 var(--s-1);
  color: var(--color-primary-strong);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
h3,
.muted {
  margin: 0;
}
.muted {
  color: var(--color-text-muted);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
}
</style>

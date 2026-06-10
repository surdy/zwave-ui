<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConfirm } from '@/composables/useConfirm'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import BaseTextField from './BaseTextField.vue'
import BaseNumberField from './BaseNumberField.vue'
import BaseSelect from './BaseSelect.vue'
import BaseSwitch from './BaseSwitch.vue'

const { queue, settle } = useConfirm()

const active = computed(() => queue[0] ?? null)
const open = computed(() => active.value !== null)

const inputValue = ref<string | number | boolean>('')

watch(
  active,
  (req) => {
    if (req?.input) {
      inputValue.value = req.input.default ?? (req.input.type === 'boolean' ? false : '')
    }
  },
  { immediate: true },
)

function onConfirm() {
  if (!active.value) return
  settle(active.value.id, {
    confirmed: true,
    value: active.value.input ? inputValue.value : undefined,
  })
}

function onCancel() {
  if (!active.value) return
  settle(active.value.id, { confirmed: false })
}
</script>

<template>
  <BaseModal
    :open="open"
    size="sm"
    :title="active?.title"
    persistent
    @close="onCancel"
  >
    <p v-if="active?.message" class="confirm__msg">{{ active.message }}</p>

    <div v-if="active?.input" class="confirm__input">
      <BaseTextField
        v-if="active.input.type === 'text'"
        v-model="(inputValue as string)"
        :label="active.input.label"
        :placeholder="active.input.placeholder"
      />
      <BaseNumberField
        v-else-if="active.input.type === 'number'"
        v-model="(inputValue as number)"
        :label="active.input.label"
      />
      <BaseSelect
        v-else-if="active.input.type === 'select'"
        v-model="(inputValue as string | number)"
        :label="active.input.label"
        :options="active.input.options ?? []"
      />
      <BaseSwitch
        v-else-if="active.input.type === 'boolean'"
        v-model="(inputValue as boolean)"
        :label="active.input.label"
      />
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="onCancel">{{ active?.cancelText }}</BaseButton>
      <BaseButton :variant="active?.danger ? 'danger' : 'primary'" @click="onConfirm">
        {{ active?.confirmText }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.confirm__msg {
  margin: 0;
  color: var(--color-text);
}
.confirm__input {
  margin-top: var(--s-4);
}
</style>

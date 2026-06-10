<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'
import type { GrantRequest, SecurityClassGrant } from '@/devices/inclusion'

const props = defineProps<{ request: GrantRequest; busy?: boolean }>()
const emit = defineEmits<{
  submit: [grant: SecurityClassGrant]
  abort: []
}>()

const selected = ref<number[]>([])
const clientSideAuth = ref(false)

const classLabels: Record<number, { title: string; hint: string }> = {
  0: { title: 'S2 Access Control', hint: 'Locks, garage doors, and access devices.' },
  1: { title: 'S2 Authenticated', hint: 'Lighting, sensors, and security systems.' },
  2: { title: 'S2 Unauthenticated', hint: 'Encrypted without device identity verification.' },
  7: { title: 'S0 Legacy', hint: 'Older devices without S2 support.' },
}

const classes = computed(() =>
  props.request.securityClasses.map((id) => ({
    id,
    title: classLabels[id]?.title ?? `Security class ${id}`,
    hint: classLabels[id]?.hint ?? 'Requested by the joining device.',
  })),
)

watch(
  () => props.request,
  (request) => {
    selected.value = [...request.securityClasses]
    clientSideAuth.value = request.clientSideAuth
  },
  { immediate: true },
)

function toggle(id: number, checked: boolean) {
  selected.value = checked ? [...new Set([...selected.value, id])] : selected.value.filter((item) => item !== id)
}

function submit() {
  emit('submit', { securityClasses: selected.value, clientSideAuth: clientSideAuth.value })
}
</script>

<template>
  <section class="s2-card" aria-labelledby="s2-grants-title">
    <div>
      <p class="eyebrow">Secure inclusion</p>
      <h3 id="s2-grants-title">Grant security classes</h3>
      <p class="muted">The device requested these classes. Leave the classes you trust enabled.</p>
    </div>

    <div class="grant-list">
      <label v-for="item in classes" :key="item.id" class="grant-row">
        <input
          type="checkbox"
          :checked="selected.includes(item.id)"
          :disabled="busy"
          @change="toggle(item.id, ($event.target as HTMLInputElement).checked)"
        />
        <span>
          <strong>{{ item.title }}</strong>
          <small>{{ item.hint }}</small>
        </span>
      </label>
      <label v-if="request.clientSideAuth" class="grant-row">
        <input v-model="clientSideAuth" type="checkbox" :disabled="busy" />
        <span>
          <strong>Client-side authentication</strong>
          <small>The device handles authentication locally.</small>
        </span>
      </label>
    </div>

    <div class="actions">
      <BaseButton variant="primary" :loading="busy" @click="submit">Grant selected</BaseButton>
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
.muted,
small {
  color: var(--color-text-muted);
}
.grant-list {
  display: grid;
  gap: var(--s-3);
}
.grant-row {
  display: flex;
  gap: var(--s-3);
  align-items: flex-start;
  min-height: 48px;
  padding: var(--s-3);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  cursor: pointer;
}
.grant-row input {
  margin-top: 0.2rem;
}
.grant-row span {
  display: grid;
  gap: var(--s-1);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
}
</style>

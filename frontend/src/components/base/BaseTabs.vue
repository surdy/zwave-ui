<script setup lang="ts">
import { ref } from 'vue'

export interface TabItem {
  label: string
  value: string | number
  disabled?: boolean
}

const model = defineModel<string | number>({ default: '' })

const props = defineProps<{
  tabs: TabItem[]
}>()

const tabRefs = ref<HTMLButtonElement[]>([])

function select(value: string | number) {
  model.value = value
}

function onKey(e: KeyboardEvent, index: number) {
  const enabled = props.tabs.map((t, i) => ({ t, i })).filter(({ t }) => !t.disabled)
  const pos = enabled.findIndex(({ i }) => i === index)
  if (pos === -1) return
  let nextPos = pos
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextPos = (pos + 1) % enabled.length
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
    nextPos = (pos - 1 + enabled.length) % enabled.length
  else if (e.key === 'Home') nextPos = 0
  else if (e.key === 'End') nextPos = enabled.length - 1
  else return
  e.preventDefault()
  const target = enabled[nextPos]
  select(target.t.value)
  tabRefs.value[target.i]?.focus()
}
</script>

<template>
  <div class="tabs" role="tablist">
    <button
      v-for="(tab, index) in tabs"
      :key="String(tab.value)"
      :ref="(el) => { if (el) tabRefs[index] = el as HTMLButtonElement }"
      type="button"
      role="tab"
      class="tabs__tab"
      :class="{ 'tabs__tab--active': model === tab.value }"
      :aria-selected="model === tab.value"
      :tabindex="model === tab.value ? 0 : -1"
      :disabled="tab.disabled"
      @click="select(tab.value)"
      @keydown="onKey($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: var(--s-1);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs::-webkit-scrollbar {
  display: none;
}
.tabs__tab {
  border: none;
  background: transparent;
  padding: var(--s-3) var(--s-4);
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  white-space: nowrap;
  transition: color 0.15s ease;
}
.tabs__tab:not(:disabled):hover {
  color: var(--color-text);
}
.tabs__tab--active {
  color: var(--color-primary-strong);
  border-bottom-color: var(--color-primary);
}
.tabs__tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

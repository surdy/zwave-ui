<script setup lang="ts">
/**
 * Automations shell. A top-level area (Advanced-tier) that hosts the two
 * automation surfaces as lazy-loaded tab panels so each stays code-split:
 *   - Scenes — saved groups of target values
 *   - Configuration templates — reusable Configuration CC parameter sets
 * Previously these were buried behind an "Automation" block inside Devices.
 */
import { computed, defineAsyncComponent, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseTabs, { type TabItem } from '@/components/base/BaseTabs.vue'

const ScenesPanel = defineAsyncComponent(() => import('@/views/ScenesView.vue'))
const TemplatesPanel = defineAsyncComponent(() => import('@/views/ConfigTemplatesView.vue'))

type AutomationTab = 'scenes' | 'templates'

const AUTOMATION_TABS: TabItem[] = [
  { label: 'Scenes', value: 'scenes' },
  { label: 'Configuration templates', value: 'templates' },
]

function isAutomationTab(value: unknown): value is AutomationTab {
  return value === 'scenes' || value === 'templates'
}

const route = useRoute()
const router = useRouter()

const queryTab = computed(() =>
  Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab,
)
const activeTab = ref<AutomationTab>(isAutomationTab(queryTab.value) ? queryTab.value : 'scenes')

function setTab(value: string | number) {
  if (!isAutomationTab(value)) return
  activeTab.value = value
  router.replace({ query: { ...route.query, tab: value } })
}
</script>

<template>
  <div class="automations-view">
    <BaseTabs :tabs="AUTOMATION_TABS" :model-value="activeTab" @update:model-value="setTab" />
    <ScenesPanel v-if="activeTab === 'scenes'" />
    <TemplatesPanel v-else-if="activeTab === 'templates'" />
  </div>
</template>

<style scoped>
.automations-view {
  display: grid;
  gap: var(--s-4);
}
</style>

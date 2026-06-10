<script setup lang="ts">
/**
 * Add-device shell. Hosts the two inclusion paths as lazy-loaded panels so each
 * can be implemented and code-split independently:
 *   - Classic inclusion / exclusion / replace (incl. secure S2) — #15
 *   - Smart Start (QR + provisioning list) — #16
 */
import { computed, defineAsyncComponent, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseTabs, { type TabItem } from '@/components/base/BaseTabs.vue'

const ClassicInclusion = defineAsyncComponent(
  () => import('@/components/add-device/ClassicInclusion.vue'),
)
const SmartStart = defineAsyncComponent(
  () => import('@/components/add-device/SmartStart.vue'),
)

type AddTab = 'classic' | 'smart-start'

const ADD_TABS: TabItem[] = [
  { label: 'Add a device', value: 'classic' },
  { label: 'Smart Start', value: 'smart-start' },
]

function isAddTab(value: unknown): value is AddTab {
  return value === 'classic' || value === 'smart-start'
}

const route = useRoute()
const router = useRouter()

const queryTab = computed(() => (Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab))
const activeTab = ref<AddTab>(isAddTab(queryTab.value) ? queryTab.value : 'classic')

function setTab(value: string | number) {
  if (!isAddTab(value)) return
  activeTab.value = value
  router.replace({ query: { ...route.query, tab: value } })
}
</script>

<template>
  <div class="add-view">
    <BaseTabs :tabs="ADD_TABS" :model-value="activeTab" @update:model-value="setTab" />
    <ClassicInclusion v-if="activeTab === 'classic'" />
    <SmartStart v-else-if="activeTab === 'smart-start'" />
  </div>
</template>

<style scoped>
.add-view {
  display: grid;
  gap: var(--s-4);
}
</style>

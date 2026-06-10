<script setup lang="ts">
import { ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseSlider from '@/components/base/BaseSlider.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import BaseNumberField from '@/components/base/BaseNumberField.vue'
import BaseTabs from '@/components/base/BaseTabs.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseSkeleton from '@/components/base/BaseSkeleton.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'

const ui = useUiStore()
const toast = useToast()
const { confirm, prompt } = useConfirm()

const switchVal = ref(true)
const sliderVal = ref(60)
const textVal = ref('')
const numberVal = ref<number | null>(20)
const selectVal = ref('s2')
const tab = ref('overview')
const modalOpen = ref(false)
const lastResult = ref('')

const selectOptions = [
  { label: 'No security', value: 's0' },
  { label: 'S2 Authenticated', value: 's2' },
  { label: 'S2 Access Control', value: 's2ac' },
]
const tabs = [
  { label: 'Overview', value: 'overview' },
  { label: 'Controls', value: 'controls' },
  { label: 'Advanced', value: 'advanced' },
]

async function askRemove() {
  const ok = await confirm({
    title: 'Remove node 12?',
    message: 'This will exclude the device from the network.',
    confirmText: 'Remove',
    danger: true,
  })
  lastResult.value = ok ? 'confirmed remove' : 'cancelled remove'
}

async function askRename() {
  const name = await prompt({
    title: 'Rename device',
    input: { type: 'text', label: 'Name', placeholder: 'Living room lamp' },
    confirmText: 'Save',
  })
  lastResult.value = name === null ? 'rename cancelled' : `renamed to "${name}"`
}
</script>

<template>
  <main class="ks">
    <header class="ks__bar">
      <h1>Component gallery</h1>
      <div class="ks__bar-actions">
        <BaseSwitch :model-value="ui.advanced" label="Advanced" @update:model-value="ui.setAdvanced" />
        <BaseButton size="sm" variant="secondary" @click="ui.setTheme(ui.resolvedTheme === 'dark' ? 'light' : 'dark')">
          Theme: {{ ui.resolvedTheme }}
        </BaseButton>
      </div>
    </header>

    <section class="ks__grid">
      <BaseCard>
        <template #header>Buttons</template>
        <div class="ks__row">
          <BaseButton>Primary</BaseButton>
          <BaseButton variant="secondary">Secondary</BaseButton>
          <BaseButton variant="ghost">Ghost</BaseButton>
          <BaseButton variant="danger">Danger</BaseButton>
        </div>
        <div class="ks__row">
          <BaseButton size="sm">Small</BaseButton>
          <BaseButton size="lg">Large</BaseButton>
          <BaseButton loading>Loading</BaseButton>
          <BaseButton disabled>Disabled</BaseButton>
        </div>
      </BaseCard>

      <BaseCard>
        <template #header>Badges &amp; status</template>
        <div class="ks__row">
          <BaseBadge>Neutral</BaseBadge>
          <BaseBadge variant="primary">Primary</BaseBadge>
          <BaseBadge variant="success">Online</BaseBadge>
          <BaseBadge variant="warning">Battery low</BaseBadge>
          <BaseBadge variant="danger">Dead</BaseBadge>
          <BaseBadge variant="advanced">Advanced</BaseBadge>
          <BaseBadge variant="expert">Expert</BaseBadge>
        </div>
        <div class="ks__row ks__row--mt">
          <span><StatusDot status="ok" pulse /> Alive</span>
          <span><StatusDot status="warn" /> Asleep</span>
          <span><StatusDot status="danger" /> Dead</span>
          <span><StatusDot status="idle" /> Unknown</span>
        </div>
      </BaseCard>

      <BaseCard>
        <template #header>Form controls</template>
        <div class="ks__stack">
          <BaseSwitch v-model="switchVal" label="Enabled" />
          <BaseSlider v-model="sliderVal" label="Brightness" unit="%" />
          <BaseTextField v-model="textVal" label="Device name" placeholder="Living room lamp" hint="Friendly name" />
          <BaseNumberField v-model="numberVal" label="Poll interval" unit="s" :min="0" :max="600" />
          <BaseSelect v-model="selectVal" label="Security" :options="selectOptions" />
        </div>
      </BaseCard>

      <BaseCard>
        <template #header>Tabs</template>
        <BaseTabs v-model="tab" :tabs="tabs" />
        <p class="ks__tabbody">Active tab: <strong>{{ tab }}</strong></p>
      </BaseCard>

      <BaseCard>
        <template #header>Overlays</template>
        <div class="ks__row">
          <BaseButton @click="modalOpen = true">Open modal</BaseButton>
          <BaseButton variant="danger" @click="askRemove">confirm()</BaseButton>
          <BaseButton variant="secondary" @click="askRename">prompt()</BaseButton>
        </div>
        <div class="ks__row ks__row--mt">
          <BaseButton size="sm" variant="ghost" @click="toast.success('Saved successfully')">Toast: success</BaseButton>
          <BaseButton size="sm" variant="ghost" @click="toast.error('Something failed')">Toast: error</BaseButton>
          <BaseButton size="sm" variant="ghost" @click="toast.info('Heads up')">Toast: info</BaseButton>
        </div>
        <p v-if="lastResult" class="ks__result">Last result: {{ lastResult }}</p>
      </BaseCard>

      <BaseCard>
        <template #header>Loading &amp; empty</template>
        <div class="ks__stack">
          <BaseSkeleton width="60%" />
          <BaseSkeleton width="100%" height="2.5rem" variant="rect" />
          <EmptyState icon="📭" title="No devices yet" description="Add your first Z-Wave device to get started.">
            <template #action><BaseButton size="sm">Add device</BaseButton></template>
          </EmptyState>
        </div>
      </BaseCard>

      <BaseCard>
        <template #header>Progressive disclosure</template>
        <p>Basic content is always visible.</p>
        <AdvancedOnly>
          <div class="ks__advanced">
            <BaseBadge variant="advanced">Advanced</BaseBadge>
            This block only appears when Advanced mode is on.
          </div>
        </AdvancedOnly>
        <p v-if="!ui.advanced" class="ks__muted">Turn on Advanced (top right) to reveal more.</p>
      </BaseCard>
    </section>

    <BaseModal v-model:open="modalOpen" title="Example modal">
      <p>Modals trap focus, close on Escape/backdrop, and restore focus on close.</p>
      <BaseTextField label="Try tabbing" placeholder="Focus stays inside" />
      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">Cancel</BaseButton>
        <BaseButton @click="modalOpen = false">Done</BaseButton>
      </template>
    </BaseModal>
  </main>
</template>

<style scoped>
.ks {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--s-5);
}
.ks__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--s-3);
  margin-bottom: var(--s-5);
}
.ks__bar-actions {
  display: flex;
  align-items: center;
  gap: var(--s-4);
}
.ks__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--s-4);
}
.ks__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
  align-items: center;
}
.ks__row--mt {
  margin-top: var(--s-3);
}
.ks__stack {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}
.ks__tabbody,
.ks__result,
.ks__muted {
  margin: var(--s-3) 0 0;
}
.ks__muted {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
.ks__advanced {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-3);
  background: var(--color-surface-2);
  border-radius: var(--r-md);
  margin-top: var(--s-2);
}
</style>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, type PropType } from 'vue'
import type { ValueId, ZwaveNode } from '@/api'
import type { SelectOption } from '@/components/base/BaseSelect.vue'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import {
  coerceParamValue,
  configParams,
  editorKind,
  getDeviceConfigurationParams,
  isModified,
  paramSearchText,
  refreshValues,
  writeValue,
  type ConfigParam,
} from '@/devices/configuration'
import { deviceStatus } from '@/devices/model'
import { useNodesStore } from '@/stores/nodes'

const props = defineProps<{ node: ZwaveNode }>()

const nodesStore = useNodesStore()
const toast = useToast()
const { confirm } = useConfirm()

const query = ref('')
const loading = ref(false)
const resettingAll = ref(false)
const pending = reactive<Record<string, boolean>>({})

const currentNode = computed(() => nodesStore.getNode(props.node.id) ?? props.node)
const asleep = computed(() => deviceStatus(currentNode.value) === 'asleep')
const params = computed(() => configParams(currentNode.value))
const filteredParams = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return params.value
  return params.value.filter((param) => paramSearchText(param).includes(q))
})
const commonParams = computed(() => filteredParams.value.filter((param) => !param.advanced))
const advancedParams = computed(() => filteredParams.value.filter((param) => param.advanced))
const modifiedWriteableValues = computed(() =>
  params.value.flatMap((param) => param.values).filter((value) => value.writeable && isModified(value) && value.default !== undefined),
)

onMounted(() => {
  void refreshConfiguration(false)
})

async function refreshConfiguration(showToast = true) {
  if (loading.value) return
  loading.value = true
  try {
    await getDeviceConfigurationParams(currentNode.value.id)
    const res = await refreshValues(currentNode.value.id)
    if (showToast) {
      if (res.success) toast.success('Configuration refreshed')
      else toast.error(res.message || 'Could not refresh configuration')
    }
  } catch {
    if (showToast) toast.error('Could not reach the Z-Wave API')
  } finally {
    loading.value = false
  }
}

async function writeParam(valueId: ValueId, raw: unknown, success = 'Parameter written') {
  if (pending[valueId.id] || !valueId.writeable) return
  const previous = valueId.value
  const next = coerceParamValue(valueId, raw)
  pending[valueId.id] = true
  nodesStore.updateValue({ ...valueId, value: next })
  if (asleep.value) toast.info('Device is asleep; write queued until it wakes.')
  try {
    const res = await writeValue(valueId, next)
    if (res.success) toast.success(asleep.value ? 'Write queued' : success)
    else {
      nodesStore.updateValue({ ...valueId, value: previous })
      toast.error(res.message || 'Z-Wave API call failed')
    }
  } catch {
    nodesStore.updateValue({ ...valueId, value: previous })
    toast.error('Could not reach the Z-Wave API')
  } finally {
    pending[valueId.id] = false
  }
}

async function resetParam(valueId: ValueId) {
  if (valueId.default === undefined) return
  await writeParam(valueId, valueId.default, 'Default restored')
}

async function resetAll() {
  if (!modifiedWriteableValues.value.length || resettingAll.value) return
  const ok = await confirm({
    danger: true,
    title: 'Reset all configuration parameters?',
    message: `This will write defaults for ${modifiedWriteableValues.value.length} modified parameter value(s).`,
    confirmText: 'Reset all',
  })
  if (!ok) return
  resettingAll.value = true
  for (const value of modifiedWriteableValues.value) {
    await writeParam(value, value.default, 'Default restored')
  }
  resettingAll.value = false
}

function stateOptions(valueId: ValueId): SelectOption[] {
  return (valueId.states ?? []).map((state) => ({ label: state.text, value: String(state.value) }))
}

function valueForSelect(valueId: ValueId): string {
  return String(valueId.value ?? '')
}

function valueForInput(valueId: ValueId): string {
  return valueId.value == null ? '' : String(valueId.value)
}

function boolValue(valueId: ValueId): boolean {
  return valueId.value === true || valueId.value === 1 || valueId.value === 'true'
}

function display(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'On' : 'Off'
  return String(value)
}

function defaultLabel(valueId: ValueId): string {
  return valueId.default === undefined ? 'No default' : display(valueId.default)
}

function editorLabel(valueId: ValueId, fallback = 'Value'): string {
  return valueId.propertyKeyName || valueId.label || fallback
}

function numericStep(valueId: ValueId): number | string | undefined {
  return valueId.step ?? undefined
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}


const ConfigParamCard = defineComponent({
  name: 'ConfigParamCard',
  props: {
    param: { type: Object as PropType<ConfigParam>, required: true },
    pending: { type: Object as PropType<Record<string, boolean>>, required: true },
  },
  emits: ['write', 'reset'],
  setup(cardProps, { emit }) {
    return () => {
      const param = cardProps.param
      const values = param.partials.length ? param.partials : [param.valueId]
      return h('article', { class: ['param card', { 'param--modified': param.modified }] }, [
        h('div', { class: 'param__meta' }, [
          h('div', { class: 'param__title' }, [
            h('span', { class: 'param__number' }, `#${param.number}`),
            h('h3', param.label),
            param.modified ? h(BaseBadge, { variant: 'warning', size: 'sm' }, () => 'Modified') : null,
            !param.writeable ? h(BaseBadge, { variant: 'neutral', size: 'sm' }, () => 'Read-only') : null,
          ]),
          param.description ? h('p', { class: 'param__description' }, param.description) : null,
          h('dl', { class: 'param__facts' }, [
            h('div', [h('dt', 'Current'), h('dd', display(param.valueId.value))]),
            h('div', [h('dt', 'Default'), h('dd', defaultLabel(param.valueId))]),
            param.valueId.unit ? h('div', [h('dt', 'Unit'), h('dd', param.valueId.unit)]) : null,
            param.valueId.min !== undefined || param.valueId.max !== undefined
              ? h('div', [h('dt', 'Range'), h('dd', `${display(param.valueId.min)} – ${display(param.valueId.max)}`)])
              : null,
          ]),
        ]),
        h('div', { class: 'param__editors' }, values.map((valueId) => renderEditor(valueId, cardProps.pending, {
          write: (raw) => emit('write', valueId, raw),
          reset: () => emit('reset', valueId),
        }))),
      ])
    }
  },
})

function renderEditor(
  valueId: ValueId,
  pendingMap: Record<string, boolean>,
  actions: { write: (raw: unknown) => void; reset: () => void },
) {
  const disabled = !valueId.writeable || Boolean(pendingMap[valueId.id])
  const kind = editorKind(valueId)
  const label = editorLabel(valueId)
  const reset = h(BaseButton, {
    size: 'sm',
    variant: 'ghost',
    disabled: disabled || valueId.default === undefined,
    loading: Boolean(pendingMap[valueId.id]),
    onClick: actions.reset,
  }, () => 'Reset')

  let control
  if (kind === 'enum') {
    control = h(BaseSelect, {
      label,
      options: stateOptions(valueId),
      modelValue: valueForSelect(valueId),
      disabled,
      'onUpdate:modelValue': (raw: string | number) => actions.write(raw),
    })
  } else if (kind === 'bool' || kind === 'bitmask') {
    control = h(BaseSwitch, {
      label,
      modelValue: boolValue(valueId),
      disabled,
      'onUpdate:modelValue': (raw: boolean) => actions.write(raw),
    })
  } else {
    control = h('label', { class: 'number-field' }, [
      h('span', { class: 'number-field__label' }, label),
      h('span', { class: 'number-field__wrap' }, [
        h('input', {
          class: 'number-field__input',
          type: 'number',
          value: valueForInput(valueId),
          min: valueId.min,
          max: valueId.max,
          step: numericStep(valueId),
          disabled,
          onChange: (event: Event) => actions.write(inputValue(event)),
        }),
        valueId.unit ? h('span', { class: 'number-field__unit' }, valueId.unit) : null,
      ]),
    ])
  }

  return h('div', { class: 'editor', key: valueId.id }, [
    control,
    h('div', { class: 'editor__footer' }, [
      h('span', { class: 'editor__default' }, `Default: ${defaultLabel(valueId)}`),
      reset,
    ]),
  ])
}
</script>

<template>
  <section class="tabpanel config-tab">
    <header class="config-head card">
      <div>
        <p class="eyebrow">Command Class 0x70</p>
        <h2>Configuration parameters</h2>
        <p class="muted">Tune device-specific options from metadata reported by Z-Wave JS.</p>
      </div>
      <div class="config-head__actions">
        <BaseBadge v-if="asleep" variant="info">Asleep · writes queued</BaseBadge>
        <BaseButton size="sm" variant="secondary" :loading="loading" @click="refreshConfiguration()">Refresh</BaseButton>
        <AdvancedOnly tag="span">
          <BaseButton
            size="sm"
            variant="danger"
            :loading="resettingAll"
            :disabled="modifiedWriteableValues.length === 0"
            @click="resetAll"
          >
            Reset all defaults
          </BaseButton>
        </AdvancedOnly>
      </div>
    </header>

    <BaseTextField v-model="query" type="search" label="Search parameters" placeholder="Parameter number or label" />

    <EmptyState
      v-if="params.length === 0"
      icon="⚙️"
      title="No configuration parameters"
      description="This node does not currently expose Configuration CC values. Try refreshing after interview completes."
    >
      <template #action>
        <BaseButton :loading="loading" @click="refreshConfiguration()">Refresh configuration</BaseButton>
      </template>
    </EmptyState>

    <EmptyState
      v-else-if="filteredParams.length === 0"
      icon="🔎"
      title="No matching parameters"
      description="Try searching by a different parameter number or label."
    />

    <div v-else class="param-groups">
      <div v-if="commonParams.length" class="param-list">
        <ConfigParamCard
          v-for="param in commonParams"
          :key="param.id"
          :param="param"
          :pending="pending"
          @write="writeParam"
          @reset="resetParam"
        />
      </div>

      <AdvancedOnly v-if="advancedParams.length" tag="section">
        <details class="advanced" open>
          <summary>
            <span>Advanced / read-only parameters</span>
            <BaseBadge variant="advanced" size="sm">{{ advancedParams.length }}</BaseBadge>
          </summary>
          <div class="param-list">
            <ConfigParamCard
              v-for="param in advancedParams"
              :key="param.id"
              :param="param"
              :pending="pending"
              @write="writeParam"
              @reset="resetParam"
            />
          </div>
        </details>
      </AdvancedOnly>
    </div>
  </section>
</template>


<style>
.tabpanel,
.config-tab,
.param-groups,
.param-list {
  display: grid;
  gap: var(--s-4);
}
.card {
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-1);
}
.config-head {
  display: flex;
  justify-content: space-between;
  gap: var(--s-4);
  padding: var(--s-5);
}
.config-head h2,
.param__title h3 {
  margin: 0;
}
.config-head__actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--s-2);
}
.eyebrow {
  margin: 0 0 var(--s-1);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.muted,
.param__description,
.editor__default {
  color: var(--color-text-muted);
}
.muted,
.param__description {
  margin: var(--s-2) 0 0;
}
.param {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 24rem);
  gap: var(--s-5);
  padding: var(--s-5);
}
.param--modified {
  border-color: var(--warn);
}
.param__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s-2);
}
.param__number {
  color: var(--color-text-muted);
  font-weight: 700;
}
.param__facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-4);
  margin: var(--s-4) 0 0;
}
.param__facts div {
  display: grid;
  gap: var(--s-1);
}
.param__facts dt {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}
.param__facts dd {
  margin: 0;
  font-weight: 600;
}
.param__editors {
  display: grid;
  gap: var(--s-3);
  align-content: start;
}
.editor {
  display: grid;
  gap: var(--s-2);
}
.editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
}
.editor__default {
  font-size: 0.8125rem;
}
.number-field {
  display: grid;
  gap: var(--s-2);
}
.number-field__label {
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 600;
}
.number-field__wrap {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}
.number-field__input {
  width: 100%;
  min-width: 0;
  padding: var(--s-3);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  font: inherit;
}
.number-field__input:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}
.number-field__input:disabled {
  background: var(--color-surface-2);
  cursor: not-allowed;
}
.number-field__unit {
  color: var(--color-text-muted);
}
.advanced {
  display: grid;
  gap: var(--s-3);
}
.advanced summary {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  cursor: pointer;
  color: var(--color-text);
  font-weight: 700;
}
.advanced[open] summary {
  margin-bottom: var(--s-3);
}
@media (max-width: 760px) {
  .config-head,
  .param {
    grid-template-columns: 1fr;
  }
  .config-head {
    display: grid;
  }
  .config-head__actions {
    justify-content: flex-start;
  }
}
</style>

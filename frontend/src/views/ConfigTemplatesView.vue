<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { ValueId, ZwaveNode } from '@/api/types'
import {
  applyConfirmationMatches,
  applyConfigurationTemplate,
  createConfigurationTemplate,
  deleteConfigurationTemplate,
  getConfigurationTemplates,
  importConfigurationTemplates,
  isCompatibleNode,
  isValidTemplateName,
  parseTemplatesJson,
  templateDeviceLabel,
  templatesToJson,
  templateValueCount,
  updateConfigurationTemplate,
  type ZUIConfigurationTemplate,
  type ZUIConfigurationTemplateValue,
} from '@/automation/configTemplates'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseNumberField from '@/components/base/BaseNumberField.vue'
import BaseSelect, { type SelectOption } from '@/components/base/BaseSelect.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { coerceParamValue, configParams, editorKind } from '@/devices/configuration'
import { useNodesStore } from '@/stores/nodes'

const toast = useToast()
const { confirm, prompt } = useConfirm()
const nodesStore = useNodesStore()
const { list: nodes } = storeToRefs(nodesStore)

const templates = ref<ZUIConfigurationTemplate[]>([])
const selectedTemplateId = ref('')
const loadingTemplates = ref(false)
const busyAction = ref<string | null>(null)

const sourceNodeId = ref<string | number>('')
const createName = ref('')
const createAutoApply = ref(false)

const editName = ref('')
const editDescription = ref('')
const editAutoApply = ref(false)
const draftValues = ref<ZUIConfigurationTemplateValue[]>([])
const valueEdits = ref<string[]>([])

const addValueOpen = ref(false)
const addNodeId = ref<string | number>('')
const addParamId = ref<string | number>('')
const addValueText = ref('')
const addValueNumber = ref<number | null>(null)

const importOpen = ref(false)
const importText = ref('')
const importing = ref(false)

const applyTemplateId = ref('')
const forceApply = ref(false)
const targetNodeIds = ref<number[]>([])
const applying = ref(false)

const deviceNodes = computed(() => nodes.value.filter((node) => !node.isControllerNode))
const configurableNodes = computed(() => deviceNodes.value.filter((node) => configParams(node).some((param) => param.writeable)))
const sourceNodeOptions = computed<SelectOption[]>(() => configurableNodes.value.map((node) => ({ label: nodeLabel(node), value: node.id })))
const selectedTemplate = computed(() => templates.value.find((template) => template.id === selectedTemplateId.value) ?? null)
const selectedApplyTemplate = computed(() => templates.value.find((template) => template.id === applyTemplateId.value) ?? selectedTemplate.value)
const templateOptions = computed<SelectOption[]>(() => templates.value.map((template) => ({ label: template.name, value: template.id })))
const canCreate = computed(() => Boolean(Number(sourceNodeId.value)) && isValidTemplateName(createName.value))
const canSave = computed(() => Boolean(selectedTemplate.value) && isValidTemplateName(editName.value))
const compatibleTargets = computed(() => {
  const template = selectedApplyTemplate.value
  if (!template) return []
  return deviceNodes.value.filter((node) => isCompatibleNode(template, node, forceApply.value))
})
const selectedTargets = computed(() => compatibleTargets.value.filter((node) => targetNodeIds.value.includes(node.id)))
const matchingPreview = computed(() => {
  const template = selectedApplyTemplate.value
  if (!template) return []
  return deviceNodes.value.filter((node) => isCompatibleNode(template, node))
})
const addNodeOptions = computed<SelectOption[]>(() => {
  const template = selectedTemplate.value
  const candidates = template ? deviceNodes.value.filter((node) => isCompatibleNode(template, node, true) && configParams(node).some((param) => param.writeable)) : configurableNodes.value
  return candidates.map((node) => ({ label: nodeLabel(node), value: node.id, disabled: template ? !isCompatibleNode(template, node) : false }))
})
const addNode = computed(() => nodes.value.find((node) => node.id === Number(addNodeId.value)) ?? null)
const addParams = computed(() => addNode.value ? configParams(addNode.value).filter((param) => param.writeable) : [])
const addParamOptions = computed<SelectOption[]>(() => addParams.value.map((param) => ({ label: `Parameter ${param.number} · ${param.label}`, value: param.id })))
const addParam = computed(() => addParams.value.find((param) => param.id === String(addParamId.value)) ?? null)
const addPrimaryValue = computed(() => addParam.value?.valueId ?? null)
const addStateOptions = computed<SelectOption[]>(() => addPrimaryValue.value?.states?.map((state) => ({ label: state.text, value: String(state.value) })) ?? [])
const canAddValue = computed(() => Boolean(addParam.value && addValueIsValid.value))
const addValueIsValid = computed(() => {
  const value = addPrimaryValue.value
  if (!value) return false
  if (value.type === 'number' || value.type === 'duration') return addValueNumber.value !== null && Number.isFinite(addValueNumber.value)
  return addValueText.value.trim().length > 0 || value.type === 'boolean' || addStateOptions.value.length > 0
})

watch(selectedTemplate, (template) => {
  editName.value = template?.name ?? ''
  editDescription.value = template?.description ?? ''
  editAutoApply.value = template?.autoApply ?? false
  draftValues.value = (template?.values ?? []).map((value) => ({ ...value }))
  valueEdits.value = draftValues.value.map((value) => stringifyValue(value.value))
  if (template && !applyTemplateId.value) applyTemplateId.value = template.id
}, { immediate: true })

watch(sourceNodeOptions, (options) => {
  if (!sourceNodeId.value) sourceNodeId.value = options[0]?.value ?? ''
}, { immediate: true })

watch(templateOptions, (options) => {
  if (!applyTemplateId.value) applyTemplateId.value = options[0]?.value ? String(options[0].value) : ''
}, { immediate: true })

watch(selectedApplyTemplate, () => {
  targetNodeIds.value = matchingPreview.value.map((node) => node.id)
}, { immediate: true })

watch(forceApply, () => {
  targetNodeIds.value = compatibleTargets.value.map((node) => node.id)
})

watch(addNode, () => {
  addParamId.value = addParamOptions.value[0]?.value ?? ''
  resetAddValue()
})

watch(addParam, resetAddValue)

onMounted(loadTemplates)

async function loadTemplates() {
  loadingTemplates.value = true
  try {
    const response = await getConfigurationTemplates()
    if (!response.success) throw new Error(response.message || 'Unable to load configuration templates')
    templates.value = response.result ?? []
    if (!selectedTemplate.value) selectedTemplateId.value = templates.value[0]?.id ?? ''
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    loadingTemplates.value = false
  }
}

async function createTemplate() {
  const nodeId = Number(sourceNodeId.value)
  const name = createName.value.trim()
  if (!nodeId || !isValidTemplateName(name)) return toast.error('Template name is required and must be 80 characters or fewer.')
  busyAction.value = 'create'
  try {
    const response = await createConfigurationTemplate(nodeId, name, createAutoApply.value)
    if (!response.success) throw new Error(response.message || 'Unable to create template')
    toast.success('Template created')
    createName.value = ''
    createAutoApply.value = false
    await loadTemplates()
    selectedTemplateId.value = response.result?.id ?? templates.value[0]?.id ?? ''
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    busyAction.value = null
  }
}

async function saveTemplate() {
  const template = selectedTemplate.value
  if (!template || !canSave.value) return
  const values = draftValues.value.map((value, index) => ({ ...value, value: coerceDraftValue(value, valueEdits.value[index]) }))
  if (await runTemplateAction('save', () => updateConfigurationTemplate(template.id, {
    name: editName.value.trim(),
    description: editDescription.value.trim() || undefined,
    autoApply: editAutoApply.value,
    values,
  }), 'Template saved')) await loadTemplates()
}

async function removeTemplate() {
  const template = selectedTemplate.value
  if (!template) return
  const ok = await confirm({
    title: 'Delete configuration template?',
    message: `Delete “${template.name}” and its ${templateValueCount(template)} parameter value${templateValueCount(template) === 1 ? '' : 's'}?`,
    confirmText: 'Delete template',
    danger: true,
  })
  if (!ok) return
  if (await runTemplateAction('delete', () => deleteConfigurationTemplate(template.id), 'Template deleted')) {
    selectedTemplateId.value = ''
    await loadTemplates()
  }
}

function openAddValue() {
  addNodeId.value = matchingPreview.value.find((node) => configParams(node).some((param) => param.writeable))?.id ?? addNodeOptions.value[0]?.value ?? ''
  addParamId.value = addParamOptions.value[0]?.value ?? ''
  resetAddValue()
  addValueOpen.value = true
}

function addTemplateValue() {
  const param = addParam.value
  const valueId = addPrimaryValue.value
  if (!param || !valueId || !canAddValue.value) return
  const raw = addStateOptions.value.length > 0 ? addValueText.value : valueId.type === 'number' || valueId.type === 'duration' ? addValueNumber.value : addValueText.value
  const value = coerceParamValue(valueId, raw)
  const templateValue: ZUIConfigurationTemplateValue = {
    property: Number(valueId.property),
    propertyKey: valueId.propertyKey == null ? null : Number(valueId.propertyKey),
    endpoint: valueId.endpoint ?? 0,
    value,
    label: param.label,
    description: param.description,
  }
  draftValues.value.push(templateValue)
  valueEdits.value.push(stringifyValue(value))
  addValueOpen.value = false
}

function removeDraftValue(index: number) {
  draftValues.value.splice(index, 1)
  valueEdits.value.splice(index, 1)
}

function openImport() {
  importText.value = ''
  importOpen.value = true
}

async function importTemplates() {
  importing.value = true
  try {
    const parsed = parseTemplatesJson(importText.value)
    const response = await importConfigurationTemplates(parsed)
    if (!response.success) throw new Error(response.message || 'Unable to import templates')
    toast.success(`Imported ${parsed.length} template${parsed.length === 1 ? '' : 's'}`)
    importOpen.value = false
    await loadTemplates()
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    importing.value = false
  }
}

function importFromFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.addEventListener('load', () => {
    importText.value = String(reader.result ?? '')
    importOpen.value = true
  })
  reader.readAsText(file)
  input.value = ''
}

function exportTemplates(scope: 'selected' | 'all') {
  const selected = selectedTemplate.value
  const payload = scope === 'all' ? templates.value : selected ? [selected] : []
  if (payload.length === 0) return toast.error('No templates to export')
  const blob = new Blob([templatesToJson(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = scope === 'all' ? 'configuration-templates.json' : `${safeFileName(payload[0].name)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function applyToTargets() {
  const template = selectedApplyTemplate.value
  if (!template || selectedTargets.value.length === 0) return
  const typed = await prompt({
    title: 'Apply configuration template?',
    message: `This will write ${templateValueCount(template)} configuration parameter value${templateValueCount(template) === 1 ? '' : 's'} to ${selectedTargets.value.length} node${selectedTargets.value.length === 1 ? '' : 's'}. Type APPLY to continue.`,
    confirmText: 'Apply template',
    danger: true,
    input: { type: 'text', label: 'Confirmation', placeholder: 'APPLY' },
  })
  if (!applyConfirmationMatches(String(typed ?? ''))) return toast.error('Typed confirmation did not match APPLY.')

  applying.value = true
  try {
    let ok = 0
    let failed = 0
    for (const node of selectedTargets.value) {
      const response = await applyConfigurationTemplate(template.id, node.id, forceApply.value)
      if (response.success) {
        ok += 1
        const result = response.result
        if (result && result.failed > 0) toast.warning(`${nodeLabel(node)}: ${result.success} applied, ${result.failed} failed`)
      } else {
        failed += 1
        toast.error(`${nodeLabel(node)}: ${response.message || 'Apply failed'}`)
      }
    }
    if (ok > 0) toast.success(`Applied template to ${ok} node${ok === 1 ? '' : 's'}${failed ? `; ${failed} failed` : ''}`)
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    applying.value = false
  }
}

async function runTemplateAction(key: string, call: () => Promise<{ success: boolean; message?: string }>, success: string): Promise<boolean> {
  busyAction.value = key
  try {
    const response = await call()
    if (!response.success) throw new Error(response.message || success)
    toast.success(success)
    return true
  } catch (error) {
    toast.error(messageFrom(error))
    return false
  } finally {
    busyAction.value = null
  }
}

function toggleTarget(nodeId: number, checked: boolean) {
  if (checked && !targetNodeIds.value.includes(nodeId)) targetNodeIds.value = [...targetNodeIds.value, nodeId]
  if (!checked) targetNodeIds.value = targetNodeIds.value.filter((id) => id !== nodeId)
}

function resetAddValue() {
  const value = addPrimaryValue.value
  if (!value) {
    addValueText.value = ''
    addValueNumber.value = null
    return
  }
  const defaultValue = value.value ?? value.default ?? value.states?.[0]?.value ?? (value.type === 'boolean' ? false : '')
  addValueText.value = String(defaultValue)
  addValueNumber.value = Number(defaultValue) || 0
}

function valueMetadata(templateValue: ZUIConfigurationTemplateValue): ValueId | undefined {
  const template = selectedTemplate.value
  const matchingNode = template ? nodes.value.find((node) => isCompatibleNode(template, node)) : undefined
  return Object.values(matchingNode?.values ?? {}).find((value) => value.commandClass === 112
    && Number(value.property) === templateValue.property
    && (value.propertyKey == null ? null : Number(value.propertyKey)) === (templateValue.propertyKey ?? null)
    && (value.endpoint ?? 0) === templateValue.endpoint)
}

function coerceDraftValue(templateValue: ZUIConfigurationTemplateValue, raw: string): unknown {
  const metadata = valueMetadata(templateValue)
  if (metadata) return coerceParamValue(metadata, raw)
  if (typeof templateValue.value === 'number') {
    const number = Number(raw)
    return Number.isFinite(number) ? number : templateValue.value
  }
  if (typeof templateValue.value === 'boolean') return ['true', '1', 'on', 'yes'].includes(raw.trim().toLowerCase())
  return raw
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatTemplateValue(value: ZUIConfigurationTemplateValue): string {
  const key = value.propertyKey == null ? '' : `.${value.propertyKey}`
  return `Parameter ${value.property}${key} · endpoint ${value.endpoint}`
}

function valueEditorType(value: ZUIConfigurationTemplateValue): 'number' | 'text' {
  const metadata = valueMetadata(value)
  if (metadata && (metadata.type === 'number' || metadata.type === 'duration' || editorKind(metadata) === 'enum')) return 'number'
  return typeof value.value === 'number' ? 'number' : 'text'
}

function numberEdit(index: number): number | null {
  const value = Number(valueEdits.value[index])
  return Number.isFinite(value) ? value : null
}

function setNumberEdit(index: number, value: number | null) {
  valueEdits.value[index] = value === null ? '' : String(value)
}

function nodeLabel(node: ZwaveNode): string {
  const name = node.name || node.productLabel || node.productDescription || `Node ${node.id}`
  return `${name} (#${node.id})`
}

function safeFileName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'configuration-template'
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Z-Wave API call failed'
}
</script>

<template>
  <section class="templates">
    <header class="hero card">
      <div>
        <p class="hero__kicker">Automation</p>
        <h1>Configuration templates</h1>
        <p>Create reusable Configuration CC parameter sets, import/export them, and apply them to matching devices.</p>
      </div>
      <div class="hero__actions">
        <BaseButton variant="secondary" :loading="loadingTemplates" @click="loadTemplates">Refresh</BaseButton>
        <BaseButton variant="secondary" :disabled="templates.length === 0" @click="exportTemplates('all')">Export all</BaseButton>
        <BaseButton variant="secondary" @click="openImport">Import JSON</BaseButton>
        <label class="upload-button">
          <input type="file" accept="application/json,.json" @change="importFromFile" />
          Upload JSON
        </label>
      </div>
    </header>

    <BaseCard>
      <template #header>
        <div class="card-title">
          <span>Create from source device</span>
          <BaseBadge variant="info" size="sm">Capture current values</BaseBadge>
        </div>
      </template>
      <div class="create-grid">
        <BaseSelect v-model="sourceNodeId" label="Source device" :options="sourceNodeOptions" placeholder="Select a device" :disabled="sourceNodeOptions.length === 0" />
        <BaseTextField v-model="createName" label="Template name" required placeholder="Motion sensor defaults" />
        <BaseSwitch v-model="createAutoApply" label="Auto-apply to matching devices" />
        <BaseButton :loading="busyAction === 'create'" :disabled="!canCreate" @click="createTemplate">Create template</BaseButton>
      </div>
    </BaseCard>

    <div class="layout">
      <BaseCard class="template-list" flush>
        <template #header>
          <div class="card-title">
            <span>Template list</span>
            <BaseBadge variant="info" size="sm">{{ templates.length }}</BaseBadge>
          </div>
        </template>

        <EmptyState v-if="!loadingTemplates && templates.length === 0" icon="🧩" title="No templates yet" description="Create a template from a configured node or import a JSON array of templates." />

        <div v-else class="template-items" aria-label="Configuration templates">
          <button
            v-for="template in templates"
            :key="template.id"
            type="button"
            class="template-item"
            :class="{ 'template-item--active': template.id === selectedTemplateId }"
            @click="selectedTemplateId = template.id"
          >
            <span>
              <strong>{{ template.name }}</strong>
              <small>{{ templateDeviceLabel(template) }}</small>
            </span>
            <span class="item-badges">
              <BaseBadge v-if="template.autoApply" variant="success" size="sm">Auto</BaseBadge>
              <BaseBadge variant="neutral" size="sm">{{ templateValueCount(template) }} values</BaseBadge>
            </span>
          </button>
        </div>
      </BaseCard>

      <BaseCard class="editor">
        <template #header>
          <div class="editor-head">
            <div>
              <span class="eyebrow">Selected template</span>
              <h2>{{ selectedTemplate?.name || 'Choose a template' }}</h2>
              <p v-if="selectedTemplate">{{ templateDeviceLabel(selectedTemplate) }}</p>
            </div>
            <BaseBadge v-if="selectedTemplate" variant="primary" size="sm">{{ draftValues.length }} values</BaseBadge>
          </div>
        </template>

        <EmptyState v-if="!selectedTemplate" icon="👈" title="Select a template" description="Choose a template from the list to edit parameter values or export it." />

        <template v-else>
          <div class="form-grid">
            <BaseTextField v-model="editName" label="Name" required />
            <label class="textarea-field">
              <span>Description</span>
              <textarea v-model="editDescription" rows="3" placeholder="Optional notes for this template" />
            </label>
            <BaseSwitch v-model="editAutoApply" label="Auto-apply to matching devices" />
          </div>

          <div class="actions">
            <BaseButton size="sm" :loading="busyAction === 'save'" :disabled="!canSave" @click="saveTemplate">Save changes</BaseButton>
            <BaseButton size="sm" variant="secondary" @click="openAddValue">Add value</BaseButton>
            <BaseButton size="sm" variant="secondary" @click="exportTemplates('selected')">Export selected</BaseButton>
            <BaseButton size="sm" variant="danger" :loading="busyAction === 'delete'" @click="removeTemplate">Delete</BaseButton>
          </div>

          <EmptyState v-if="draftValues.length === 0" icon="➕" title="No parameter values" description="Add a writeable Configuration CC parameter value before applying this template." />

          <div v-else class="value-list">
            <article v-for="(value, index) in draftValues" :key="`${value.property}:${value.propertyKey}:${value.endpoint}:${index}`" class="value-row">
              <div>
                <strong>{{ value.label || formatTemplateValue(value) }}</strong>
                <p>{{ formatTemplateValue(value) }}</p>
                <small v-if="value.description">{{ value.description }}</small>
              </div>
              <BaseNumberField v-if="valueEditorType(value) === 'number'" :model-value="numberEdit(index)" label="Target" @update:model-value="setNumberEdit(index, $event)" />
              <BaseTextField v-else v-model="valueEdits[index]" label="Target" />
              <BaseButton size="sm" variant="danger" @click="removeDraftValue(index)">Remove</BaseButton>
            </article>
          </div>
        </template>
      </BaseCard>
    </div>

    <AdvancedOnly>
      <BaseCard class="apply-card">
        <template #header>
          <div class="card-title">
            <span>Apply template</span>
            <BaseBadge variant="expert" size="sm">Expert</BaseBadge>
          </div>
        </template>
        <p class="warning">Bulk apply writes Configuration CC parameters to every selected node. Review the preview and type APPLY when prompted.</p>
        <div class="apply-grid">
          <BaseSelect v-model="applyTemplateId" label="Template" :options="templateOptions" placeholder="Select a template" :disabled="templateOptions.length === 0" />
          <BaseSwitch v-model="forceApply" label="Force override compatibility" />
          <BaseBadge variant="neutral">{{ matchingPreview.length }} compatible</BaseBadge>
          <BaseBadge v-if="forceApply" variant="warning">Force includes all devices</BaseBadge>
        </div>

        <div v-if="selectedApplyTemplate" class="target-list">
          <div class="apply-preview">
            <strong>Change preview</strong>
            <p>Will write {{ templateValueCount(selectedApplyTemplate) }} configuration value{{ templateValueCount(selectedApplyTemplate) === 1 ? '' : 's' }}:</p>
            <ul>
              <li v-for="(value, index) in selectedApplyTemplate.values" :key="`${value.property}:${value.propertyKey}:${value.endpoint}:${index}`">
                {{ value.label || formatTemplateValue(value) }} → {{ stringifyValue(value.value) || '—' }}
              </li>
            </ul>
          </div>
          <label v-for="node in compatibleTargets" :key="node.id" class="target-row" :class="{ 'target-row--forced': !isCompatibleNode(selectedApplyTemplate, node) }">
            <input type="checkbox" :checked="targetNodeIds.includes(node.id)" @change="toggleTarget(node.id, ($event.target as HTMLInputElement).checked)" />
            <span>
              <strong>{{ nodeLabel(node) }}</strong>
              <small>{{ isCompatibleNode(selectedApplyTemplate, node) ? 'Compatible match' : 'Force-only target' }}</small>
            </span>
          </label>
        </div>
        <EmptyState v-else icon="🧩" title="No template selected" description="Choose a template before selecting target devices." />

        <div class="actions">
          <BaseButton variant="danger" :loading="applying" :disabled="!selectedApplyTemplate || selectedTargets.length === 0" @click="applyToTargets">
            Apply to {{ selectedTargets.length }} node{{ selectedTargets.length === 1 ? '' : 's' }}
          </BaseButton>
        </div>
      </BaseCard>
    </AdvancedOnly>

    <BaseModal v-model:open="addValueOpen" title="Add parameter value" size="md">
      <div class="form-grid">
        <BaseSelect v-model="addNodeId" label="Metadata device" :options="addNodeOptions" placeholder="Select a device" :disabled="addNodeOptions.length === 0" />
        <BaseSelect v-model="addParamId" label="Parameter" :options="addParamOptions" placeholder="Select a parameter" :disabled="addParamOptions.length === 0" />
        <BaseSelect v-if="addStateOptions.length > 0" v-model="addValueText" label="Target value" :options="addStateOptions" />
        <BaseNumberField v-else-if="addPrimaryValue?.type === 'number' || addPrimaryValue?.type === 'duration'" v-model="addValueNumber" label="Target value" :min="addPrimaryValue.min" :max="addPrimaryValue.max" :step="addPrimaryValue.step ?? 1" :unit="addPrimaryValue.unit" />
        <BaseTextField v-else v-model="addValueText" label="Target value" placeholder="Value to apply" />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="addValueOpen = false">Cancel</BaseButton>
        <BaseButton :disabled="!canAddValue" @click="addTemplateValue">Add value</BaseButton>
      </template>
    </BaseModal>

    <BaseModal v-model:open="importOpen" title="Import configuration templates" size="lg">
      <label class="textarea-field">
        <span>JSON array</span>
        <textarea v-model="importText" rows="12" placeholder="Paste exported configuration templates JSON" />
      </label>
      <template #footer>
        <BaseButton variant="ghost" @click="importOpen = false">Cancel</BaseButton>
        <BaseButton :loading="importing" :disabled="importText.trim().length === 0" @click="importTemplates">Import</BaseButton>
      </template>
    </BaseModal>
  </section>
</template>

<style scoped>
.templates { display: grid; gap: var(--s-5); }
.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); box-shadow: var(--shadow-1); padding: var(--s-5); }
.hero { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-4); }
.hero h1, .editor h2 { margin: 0; }
.hero p, .editor-head p, .warning { margin: var(--s-2) 0 0; color: var(--color-text-muted); }
.hero__kicker, .eyebrow { margin: 0; color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
.hero__actions, .actions, .card-title, .editor-head, .item-badges, .apply-grid { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; }
.card-title, .editor-head { justify-content: space-between; }
.create-grid, .apply-grid { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr) auto auto; gap: var(--s-4); align-items: end; }
.layout { display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: var(--s-4); align-items: start; }
.template-items { display: grid; }
.template-item { display: flex; justify-content: space-between; align-items: center; gap: var(--s-3); width: 100%; padding: var(--s-4) var(--s-5); border: 0; border-bottom: 1px solid var(--color-border); background: transparent; color: var(--color-text); text-align: left; cursor: pointer; }
.template-item:hover, .template-item--active { background: var(--color-surface-2); }
.template-item strong { display: block; }
.template-item small, .value-row small, .value-row p, .target-row small { color: var(--color-text-muted); }
.form-grid { display: grid; gap: var(--s-4); margin-bottom: var(--s-4); }
.actions { margin-top: var(--s-4); margin-bottom: var(--s-4); }
.value-list, .target-list { display: grid; gap: var(--s-3); }
.value-row { display: grid; grid-template-columns: minmax(180px, 1.4fr) minmax(160px, 0.8fr) auto; gap: var(--s-3); align-items: center; padding: var(--s-4); border: 1px solid var(--color-border); border-radius: var(--r-md); background: var(--color-surface-2); }
.value-row p { margin: var(--s-1) 0; }
.target-row { display: flex; gap: var(--s-3); align-items: center; padding: var(--s-3); border: 1px solid var(--color-border); border-radius: var(--r-md); background: var(--color-surface-2); }
.target-row--forced { border-style: dashed; }
.target-row strong { display: block; }
.apply-preview { padding: var(--s-4); border: 1px solid var(--color-border); border-radius: var(--r-md); background: var(--color-surface-2); }
.apply-preview p { margin: var(--s-1) 0 var(--s-2); color: var(--color-text-muted); }
.apply-preview ul { margin: 0; padding-left: var(--s-5); }
.textarea-field { display: grid; gap: var(--s-2); font-size: 0.875rem; font-weight: 600; color: var(--color-text); }
.textarea-field textarea { width: 100%; resize: vertical; padding: var(--s-3); font: inherit; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-md); }
.textarea-field textarea:focus-visible { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
.upload-button { display: inline-flex; align-items: center; justify-content: center; padding: var(--s-3) var(--s-4); border: 1px solid var(--color-border); border-radius: var(--r-md); background: var(--color-surface); color: var(--color-text); font-weight: 600; line-height: 1; cursor: pointer; }
.upload-button:hover { background: var(--color-surface-2); }
.upload-button input { position: absolute; inline-size: 1px; block-size: 1px; opacity: 0; pointer-events: none; }
@media (max-width: 920px) {
  .hero, .editor-head { flex-direction: column; }
  .hero__actions { justify-content: flex-start; }
  .layout, .value-row, .create-grid, .apply-grid { grid-template-columns: 1fr; }
}
</style>

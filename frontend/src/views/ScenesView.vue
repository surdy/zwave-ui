<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { ValueId, ZwaveNode } from '@/api/types'
import {
  activateScene,
  addSceneValue,
  coerceSceneValue,
  createScene,
  formatSceneValue,
  getScenes,
  isValidSceneLabel,
  isWriteableValue,
  nextSceneLabel,
  removeScene,
  removeSceneValue,
  sceneGetValues,
  sceneValueCount,
  setScenes,
  type ZUIScene,
  type ZUIValueIdScene,
} from '@/automation/scenes'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseNumberField from '@/components/base/BaseNumberField.vue'
import BaseSelect, { type SelectOption } from '@/components/base/BaseSelect.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useNodesStore } from '@/stores/nodes'

const toast = useToast()
const { confirm, prompt } = useConfirm()
const nodesStore = useNodesStore()
const { list: nodes } = storeToRefs(nodesStore)

const scenes = ref<ZUIScene[]>([])
const selectedSceneId = ref<number | null>(null)
const sceneValues = ref<ZUIValueIdScene[]>([])
const loadingScenes = ref(false)
const loadingValues = ref(false)
const savingValue = ref(false)
const busyAction = ref<string | null>(null)
const modalOpen = ref(false)
const selectedNodeId = ref<string | number>('')
const selectedValueId = ref<string | number>('')
const targetText = ref('')
const targetNumber = ref<number | null>(null)
const timeoutSeconds = ref<number | null>(null)

const selectedScene = computed(() => scenes.value.find((scene) => scene.sceneid === selectedSceneId.value) ?? null)
const selectedNode = computed(() => nodes.value.find((node) => node.id === Number(selectedNodeId.value)) ?? null)
const writeableNodes = computed(() => nodes.value.filter((node) => nodeValues(node).some(isWriteableValue)))
const nodeOptions = computed<SelectOption[]>(() => writeableNodes.value.map((node) => ({ label: nodeLabel(node), value: node.id })))
const writeableValues = computed(() => (selectedNode.value ? nodeValues(selectedNode.value).filter(isWriteableValue) : []))
const valueOptions = computed<SelectOption[]>(() => writeableValues.value.map((value) => ({ label: valueLabel(value), value: value.id })))
const selectedValue = computed(() => writeableValues.value.find((value) => value.id === String(selectedValueId.value)) ?? null)
const stateOptions = computed<SelectOption[]>(() => {
  const states = selectedValue.value?.states ?? []
  if (states.length > 0) return states.map((state) => ({ label: state.text, value: String(state.value) }))
  if (selectedValue.value?.type === 'boolean') return [{ label: 'On', value: 'true' }, { label: 'Off', value: 'false' }]
  return []
})
const canSaveValue = computed(() => Boolean(selectedScene.value && selectedValue.value && targetIsValid.value))
const targetIsValid = computed(() => {
  const value = selectedValue.value
  if (!value) return false
  if (value.type === 'number' || value.type === 'duration') return targetNumber.value !== null && Number.isFinite(targetNumber.value)
  return String(targetText.value).trim().length > 0 || value.type === 'boolean' || stateOptions.value.length > 0
})

watch(selectedSceneId, (id) => {
  sceneValues.value = []
  if (id !== null) void loadSceneValues(id)
})

watch(selectedNodeId, () => {
  selectedValueId.value = ''
  resetTarget()
}, { flush: 'sync' })

watch(selectedValue, resetTarget)

onMounted(loadScenes)

async function loadScenes() {
  loadingScenes.value = true
  try {
    const response = await getScenes()
    if (!response.success) throw new Error(response.message || 'Unable to load scenes')
    scenes.value = response.result ?? []
    if (!selectedScene.value) selectedSceneId.value = scenes.value[0]?.sceneid ?? null
    if (selectedSceneId.value === null) sceneValues.value = []
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    loadingScenes.value = false
  }
}

async function loadSceneValues(sceneid: number) {
  loadingValues.value = true
  try {
    const response = await sceneGetValues(sceneid)
    if (!response.success) throw new Error(response.message || 'Unable to load scene values')
    sceneValues.value = response.result ?? []
    updateSelectedSceneValues(sceneValues.value)
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    loadingValues.value = false
  }
}

async function createNewScene() {
  const value = await prompt({
    title: 'Create scene',
    message: 'Scenes apply a named set of target values on demand.',
    confirmText: 'Create',
    input: { type: 'text', label: 'Scene name', default: nextSceneLabel(scenes.value) },
  })
  const label = String(value ?? '').trim()
  if (!value || !isValidSceneLabel(label)) {
    if (value !== null) toast.error('Scene name is required and must be 80 characters or fewer.')
    return
  }
  if (await runSceneAction('create', () => createScene(label), 'Scene created')) await loadScenes()
}

async function renameSelectedScene() {
  const scene = selectedScene.value
  if (!scene) return
  const value = await prompt({
    title: 'Rename scene',
    confirmText: 'Rename',
    input: { type: 'text', label: 'Scene name', default: scene.label },
  })
  const label = String(value ?? '').trim()
  if (value === null || label === scene.label) return
  if (!isValidSceneLabel(label)) return toast.error('Scene name is required and must be 80 characters or fewer.')

  const next = scenes.value.map((item) => (item.sceneid === scene.sceneid ? { ...item, label } : item))
  if (await runSceneAction('rename', () => setScenes(next), 'Scene renamed')) scenes.value = next
}

async function removeSelectedScene() {
  const scene = selectedScene.value
  if (!scene) return
  const ok = await confirm({
    title: 'Remove scene?',
    message: `Remove “${scene.label}” and all ${sceneValueCount(scene)} saved value${sceneValueCount(scene) === 1 ? '' : 's'}?`,
    confirmText: 'Remove scene',
    danger: true,
  })
  if (!ok) return
  if (await runSceneAction('remove', () => removeScene(scene.sceneid), 'Scene removed')) {
    selectedSceneId.value = null
    await loadScenes()
  }
}

async function activateSelectedScene() {
  const scene = selectedScene.value
  if (!scene) return
  await runSceneAction('activate', () => activateScene(scene.sceneid), `Activated ${scene.label}`)
}

function openAddValue() {
  selectedNodeId.value = nodeOptions.value[0]?.value ?? ''
  selectedValueId.value = valueOptions.value[0]?.value ?? ''
  resetTarget()
  modalOpen.value = true
}

async function saveSceneValue() {
  const scene = selectedScene.value
  const value = selectedValue.value
  if (!scene || !value || !canSaveValue.value) return
  savingValue.value = true
  try {
    const raw = stateOptions.value.length > 0 ? targetText.value : value.type === 'number' || value.type === 'duration' ? targetNumber.value : targetText.value
    const state = value.states?.find((item) => String(item.value) === String(raw))
    const target = state ? state.value : coerceSceneValue(raw, value.type)
    const timeout = Math.max(0, Number(timeoutSeconds.value ?? 0))
    const sceneValue: ZUIValueIdScene = { ...value, value: target, timeout }
    const response = await addSceneValue(scene.sceneid, sceneValue, target, timeout)
    if (!response.success) throw new Error(response.message || 'Unable to add value')
    toast.success('Scene value saved')
    modalOpen.value = false
    await loadSceneValues(scene.sceneid)
    await loadScenes()
  } catch (error) {
    toast.error(messageFrom(error))
  } finally {
    savingValue.value = false
  }
}

async function removeValue(value: ZUIValueIdScene) {
  const scene = selectedScene.value
  if (!scene) return
  const ok = await confirm({
    title: 'Remove value?',
    message: `Remove ${formatValue(value)} from “${scene.label}”?`,
    confirmText: 'Remove value',
    danger: true,
  })
  if (!ok) return
  if (await runSceneAction(`remove-value:${value.id}`, () => removeSceneValue(scene.sceneid, value), 'Value removed')) {
    await loadSceneValues(scene.sceneid)
    await loadScenes()
  }
}

async function runSceneAction(key: string, call: () => Promise<{ success: boolean; message?: string }>, success: string): Promise<boolean> {
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

function updateSelectedSceneValues(values: ZUIValueIdScene[]) {
  const scene = selectedScene.value
  if (!scene) return
  scenes.value = scenes.value.map((item) => (item.sceneid === scene.sceneid ? { ...item, values } : item))
}

function resetTarget() {
  const value = selectedValue.value
  if (!value) {
    targetText.value = ''
    targetNumber.value = null
    timeoutSeconds.value = 0
    return
  }
  const defaultValue = value.value ?? value.default ?? value.states?.[0]?.value ?? (value.type === 'boolean' ? false : '')
  if (value.type === 'number' || value.type === 'duration') targetNumber.value = Number(defaultValue) || 0
  targetText.value = String(defaultValue)
  timeoutSeconds.value = 0
}

function nodeValues(node: ZwaveNode): ValueId[] {
  return Object.values(node.values ?? {}).sort((a, b) => a.id.localeCompare(b.id))
}

function nodeLabel(node: ZwaveNode): string {
  const name = node.name || node.productLabel || node.productDescription || `Node ${node.id}`
  return `${name} (#${node.id})`
}

function valueLabel(value: ValueId): string {
  const name = [value.label || value.propertyName || String(value.property), value.propertyKeyName].filter(Boolean).join(' · ')
  return `${name} · CC ${value.commandClass}${value.endpoint ? ` · EP ${value.endpoint}` : ''}`
}

function valueMetadata(value: ZUIValueIdScene): ValueId | undefined {
  return nodes.value.find((node) => node.id === value.nodeId)?.values?.[value.id]
}

function formatValue(value: ZUIValueIdScene): string {
  return formatSceneValue(value, valueMetadata(value) ?? value)
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Z-Wave API call failed'
}
</script>

<template>
  <section class="scenes">
    <header class="hero card">
      <div>
        <p class="hero__kicker">Automation</p>
        <h1>Scenes</h1>
        <p>Save groups of target values and activate them together, with optional per-value delays.</p>
      </div>
      <div class="hero__actions">
        <BaseButton variant="secondary" :loading="loadingScenes" @click="loadScenes">Refresh</BaseButton>
        <BaseButton @click="createNewScene">New scene</BaseButton>
      </div>
    </header>

    <div class="layout">
      <BaseCard class="scene-list" flush>
        <template #header>
          <div class="card-title">
            <span>Scene list</span>
            <BaseBadge variant="info" size="sm">{{ scenes.length }}</BaseBadge>
          </div>
        </template>

        <EmptyState v-if="!loadingScenes && scenes.length === 0" icon="🎬" title="No scenes yet" description="Create a scene, add writeable device values, then activate them together.">
          <template #action><BaseButton @click="createNewScene">Create scene</BaseButton></template>
        </EmptyState>

        <div v-else class="scene-items" aria-label="Scenes">
          <button
            v-for="scene in scenes"
            :key="scene.sceneid"
            type="button"
            class="scene-item"
            :class="{ 'scene-item--active': scene.sceneid === selectedSceneId }"
            @click="selectedSceneId = scene.sceneid"
          >
            <span>
              <strong>{{ scene.label }}</strong>
              <small>Scene {{ scene.sceneid }}</small>
            </span>
            <BaseBadge size="sm" variant="neutral">{{ sceneValueCount(scene) }} values</BaseBadge>
          </button>
        </div>
      </BaseCard>

      <BaseCard class="editor">
        <template #header>
          <div class="editor-head">
            <div>
              <span class="eyebrow">Selected scene</span>
              <h2>{{ selectedScene?.label || 'Choose a scene' }}</h2>
            </div>
            <BaseBadge v-if="selectedScene" variant="primary" size="sm">{{ sceneValues.length }} values</BaseBadge>
          </div>
        </template>

        <EmptyState v-if="!selectedScene" icon="👈" title="Select a scene" description="Choose a scene from the list to edit its values or activate it." />

        <template v-else>
          <div class="actions">
            <BaseButton size="sm" :loading="busyAction === 'activate'" :disabled="sceneValues.length === 0" @click="activateSelectedScene">Activate</BaseButton>
            <BaseButton size="sm" variant="secondary" @click="openAddValue">Add value</BaseButton>
            <BaseButton size="sm" variant="secondary" @click="renameSelectedScene">Rename</BaseButton>
            <BaseButton size="sm" variant="danger" :loading="busyAction === 'remove'" @click="removeSelectedScene">Remove</BaseButton>
          </div>

          <EmptyState v-if="!loadingValues && sceneValues.length === 0" icon="➕" title="No values in this scene" description="Add a writeable value from a node, choose its target value, and optionally delay it.">
            <template #action><BaseButton variant="secondary" @click="openAddValue">Add first value</BaseButton></template>
          </EmptyState>

          <div v-else class="value-list">
            <article v-for="value in sceneValues" :key="`${value.nodeId}:${value.id}`" class="value-row">
              <div>
                <strong>{{ valueMetadata(value)?.label || value.label || value.propertyName || value.property }}</strong>
                <p>{{ nodeLabel(nodesStore.getNode(value.nodeId) || ({ id: value.nodeId, ready: false, available: false, failed: false } as ZwaveNode)) }}</p>
                <small>{{ value.id }}</small>
              </div>
              <div class="value-row__target">
                <span>{{ formatValue(value) }}</span>
                <BaseBadge v-if="value.timeout > 0" variant="warning" size="sm">{{ value.timeout }}s delay</BaseBadge>
              </div>
              <BaseButton size="sm" variant="danger" :loading="busyAction === `remove-value:${value.id}`" @click="removeValue(value)">Remove</BaseButton>
            </article>
          </div>
        </template>
      </BaseCard>
    </div>

    <BaseModal v-model:open="modalOpen" title="Add scene value" size="md">
      <div class="form-grid">
        <BaseSelect v-model="selectedNodeId" label="Node" :options="nodeOptions" placeholder="Select a node" :disabled="nodeOptions.length === 0" />
        <BaseSelect v-model="selectedValueId" label="Writeable value" :options="valueOptions" placeholder="Select a value" :disabled="valueOptions.length === 0" />

        <BaseSelect v-if="stateOptions.length > 0" v-model="targetText" label="Target value" :options="stateOptions" />
        <BaseNumberField v-else-if="selectedValue?.type === 'number' || selectedValue?.type === 'duration'" v-model="targetNumber" label="Target value" :min="selectedValue.min" :max="selectedValue.max" :step="selectedValue.step ?? 1" :unit="selectedValue.unit" />
        <BaseTextField v-else v-model="targetText" label="Target value" placeholder="Value to apply" />

        <BaseNumberField v-model="timeoutSeconds" label="Timeout" :min="0" :step="1" unit="seconds" hint="0 applies immediately." />
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">Cancel</BaseButton>
        <BaseButton :loading="savingValue" :disabled="!canSaveValue" @click="saveSceneValue">Save value</BaseButton>
      </template>
    </BaseModal>
  </section>
</template>

<style scoped>
.scenes { display: grid; gap: var(--s-5); }
.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); box-shadow: var(--shadow-1); padding: var(--s-5); }
.hero { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-4); }
.hero h1, .editor h2 { margin: 0; }
.hero p { margin: var(--s-2) 0 0; color: var(--color-text-muted); }
.hero__kicker, .eyebrow { margin: 0; color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
.hero__actions, .actions, .card-title, .editor-head, .value-row__target { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; }
.layout { display: grid; grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); gap: var(--s-4); align-items: start; }
.card-title, .editor-head { justify-content: space-between; }
.scene-items { display: grid; }
.scene-item { display: flex; justify-content: space-between; align-items: center; gap: var(--s-3); width: 100%; padding: var(--s-4) var(--s-5); border: 0; border-bottom: 1px solid var(--color-border); background: transparent; color: var(--color-text); text-align: left; cursor: pointer; }
.scene-item:hover, .scene-item--active { background: var(--color-surface-2); }
.scene-item strong { display: block; }
.scene-item small, .value-row small, .value-row p { color: var(--color-text-muted); }
.actions { margin-bottom: var(--s-4); }
.value-list { display: grid; gap: var(--s-3); }
.value-row { display: grid; grid-template-columns: minmax(180px, 1.3fr) minmax(160px, 1fr) auto; gap: var(--s-3); align-items: center; padding: var(--s-4); border: 1px solid var(--color-border); border-radius: var(--r-md); background: var(--color-surface-2); }
.value-row p { margin: var(--s-1) 0; }
.value-row__target { justify-content: flex-start; }
.form-grid { display: grid; gap: var(--s-4); }
@media (max-width: 820px) {
  .hero, .editor-head { flex-direction: column; }
  .hero__actions { justify-content: flex-start; }
  .layout, .value-row { grid-template-columns: 1fr; }
}
</style>

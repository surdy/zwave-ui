<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { ZwaveNode } from '@/api'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import {
  addAssociations,
  associationGroups,
  availableTargets,
  canAddToGroup,
  checkAssociation,
  getAssociations,
  removeAssociations,
  resolveMemberName,
  sourceForGroup,
  type AssociationAddress,
  type AssociationGroup,
  type GroupAssociation,
} from '@/devices/associations'
import { deviceName } from '@/devices/model'
import { useNodesStore } from '@/stores/nodes'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSelect, { type SelectOption } from '@/components/base/BaseSelect.vue'
import EmptyState from '@/components/base/EmptyState.vue'

const props = defineProps<{ node: ZwaveNode }>()

const toast = useToast()
const { confirm } = useConfirm()
const nodesStore = useNodesStore()
const rawAssociations = ref<GroupAssociation[]>([])
const loading = ref(false)
const error = ref('')
const pending = reactive<Record<string, boolean>>({})
const selectedTargets = reactive<Record<string, string | number>>({})
const selectedEndpoints = reactive<Record<string, string | number>>({})

const groups = computed(() => associationGroups(props.node, rawAssociations.value))
const targetNodes = computed(() => nodesStore.devices)
const allNodes = computed(() => nodesStore.list)

watch(
  () => props.node.id,
  () => {
    clearSelections()
    void refreshAssociations()
  },
)

onMounted(() => {
  void refreshAssociations()
})

async function refreshAssociations() {
  loading.value = true
  error.value = ''
  try {
    const res = await getAssociations(props.node.id)
    if (res.success) {
      rawAssociations.value = res.result ?? []
      return
    }
    rawAssociations.value = []
    error.value = res.message || 'Could not load associations.'
  } catch {
    rawAssociations.value = []
    error.value = 'Could not reach the Z-Wave API.'
  } finally {
    loading.value = false
  }
}

function groupKey(group: AssociationGroup): string {
  return `${group.endpoint}:${group.id}`
}

function source(group: AssociationGroup): AssociationAddress {
  return sourceForGroup(props.node, group)
}

function targetOptions(group: AssociationGroup): SelectOption[] {
  return availableTargets(targetNodes.value, props.node, group).map((node) => ({
    label: `${deviceName(node)} · Node ${node.id}`,
    value: node.id,
  }))
}

function endpointOptions(targetId: string | number): SelectOption[] {
  const node = nodesStore.getNode(Number(targetId))
  const count = Number(node?.endpointsCount ?? 0)
  const options: SelectOption[] = [{ label: 'Root device', value: 0 }]
  for (let endpoint = 1; endpoint <= count; endpoint += 1) {
    options.push({ label: `Endpoint ${endpoint}`, value: endpoint })
  }
  return options
}

function selectedTarget(group: AssociationGroup): AssociationAddress | null {
  const key = groupKey(group)
  const nodeId = Number(selectedTargets[key])
  if (!Number.isFinite(nodeId) || nodeId <= 0) return null
  const endpoint = group.multiChannel ? Number(selectedEndpoints[key] ?? 0) : 0
  return endpoint > 0 ? { nodeId, endpoint } : { nodeId }
}

function memberLabel(member: AssociationAddress): string {
  return resolveMemberName(allNodes.value, member)
}

function memberMeta(member: AssociationAddress): string {
  return `Node ${member.nodeId}${member.endpoint ? ` · endpoint ${member.endpoint}` : ''}`
}

function isCheckOk(value: unknown): boolean {
  return value === 0 || value === 'OK' || value === true || value == null
}

async function addMember(group: AssociationGroup) {
  const target = selectedTarget(group)
  if (!target) return
  const key = `add:${groupKey(group)}`
  if (pending[key]) return
  pending[key] = true
  try {
    const check = await checkAssociation(source(group), group.id, target)
    if (!check.success || !isCheckOk(check.result)) {
      toast.error(check.message || 'This association is not allowed for the selected group.')
      return
    }
    const res = await addAssociations(source(group), group.id, [target])
    if (!res.success) {
      toast.error(res.message || 'Could not add association.')
      return
    }
    toast.success('Association added')
    delete selectedTargets[groupKey(group)]
    delete selectedEndpoints[groupKey(group)]
    await refreshAssociations()
  } catch {
    toast.error('Could not reach the Z-Wave API.')
  } finally {
    pending[key] = false
  }
}

async function removeMember(group: AssociationGroup, member: AssociationAddress) {
  const key = `remove:${groupKey(group)}:${member.nodeId}:${member.endpoint ?? 0}`
  if (pending[key]) return
  pending[key] = true
  try {
    const res = await removeAssociations(source(group), group.id, [member])
    if (res.success) {
      toast.success('Association removed')
      await refreshAssociations()
    } else {
      toast.error(res.message || 'Could not remove association.')
    }
  } catch {
    toast.error('Could not reach the Z-Wave API.')
  } finally {
    pending[key] = false
  }
}

async function removeAll(group: AssociationGroup) {
  if (group.members.length === 0) return
  const ok = await confirm({
    danger: true,
    title: `Remove all associations from ${group.title}?`,
    message: 'This removes every target from this association group. Devices may stop controlling each other directly.',
    confirmText: 'Remove all',
  })
  if (!ok) return

  const key = `remove-all:${groupKey(group)}`
  pending[key] = true
  try {
    const res = await removeAssociations(source(group), group.id, group.members)
    if (res.success) {
      toast.success('Associations removed')
      await refreshAssociations()
    } else {
      toast.error(res.message || 'Could not remove associations.')
    }
  } catch {
    toast.error('Could not reach the Z-Wave API.')
  } finally {
    pending[key] = false
  }
}

function clearSelections() {
  for (const key of Object.keys(selectedTargets)) delete selectedTargets[key]
  for (const key of Object.keys(selectedEndpoints)) delete selectedEndpoints[key]
}
</script>

<template>
  <section class="tabpanel associations">
    <div class="associations__head">
      <div>
        <h2>Associations</h2>
        <p class="muted">Manage direct device-to-device links for {{ deviceName(node) }}.</p>
      </div>
      <BaseButton variant="secondary" :loading="loading" @click="refreshAssociations">Refresh</BaseButton>
    </div>

    <details class="info-card">
      <summary>What are associations?</summary>
      <p>
        Associations let a Z-Wave device talk directly to another device without automations. They are advanced settings;
        the Lifeline group is usually reserved for controller status reports.
      </p>
    </details>

    <p v-if="error" class="notice" role="alert">{{ error }}</p>

    <EmptyState
      v-if="!loading && groups.length === 0"
      icon="🔗"
      title="No association groups"
      description="This device has not reported any association groups."
    />

    <article v-for="group in groups" :key="groupKey(group)" class="group-card">
      <header class="group-card__head">
        <div>
          <h3>Group {{ group.id }} · {{ group.title }}</h3>
          <p class="muted">
            {{ group.members.length }} / {{ group.maxNodes }} members
            <span v-if="group.endpoint"> · source endpoint {{ group.endpoint }}</span>
          </p>
        </div>
        <div class="badges">
          <BaseBadge v-if="group.isLifeline" variant="primary" size="sm">Lifeline</BaseBadge>
          <BaseBadge v-if="group.multiChannel" variant="info" size="sm">Multi-channel</BaseBadge>
        </div>
      </header>

      <div class="members">
        <div v-for="member in group.members" :key="`${member.nodeId}:${member.endpoint ?? 0}`" class="member-row">
          <div>
            <strong>{{ memberLabel(member) }}</strong>
            <small>{{ memberMeta(member) }}</small>
          </div>
          <BaseButton
            size="sm"
            variant="ghost"
            :loading="pending[`remove:${groupKey(group)}:${member.nodeId}:${member.endpoint ?? 0}`]"
            @click="removeMember(group, member)"
          >Remove</BaseButton>
        </div>
        <p v-if="group.members.length === 0" class="muted empty-members">No members in this group.</p>
      </div>

      <form class="add-form" @submit.prevent="addMember(group)">
        <BaseSelect
          v-model="selectedTargets[groupKey(group)]"
          label="Target node"
          placeholder="Choose a node"
          :options="targetOptions(group)"
          :disabled="!canAddToGroup(group, group.members.length) || targetOptions(group).length === 0"
        />
        <BaseSelect
          v-if="group.multiChannel && selectedTargets[groupKey(group)]"
          v-model="selectedEndpoints[groupKey(group)]"
          label="Target endpoint"
          :options="endpointOptions(selectedTargets[groupKey(group)])"
        />
        <div class="actions">
          <BaseButton
            type="submit"
            :loading="pending[`add:${groupKey(group)}`]"
            :disabled="!selectedTarget(group)"
          >Add</BaseButton>
          <BaseButton
            variant="danger"
            :loading="pending[`remove-all:${groupKey(group)}`]"
            :disabled="group.members.length === 0"
            @click="removeAll(group)"
          >Remove all</BaseButton>
        </div>
      </form>
    </article>
  </section>
</template>

<style scoped>
.tabpanel,
.associations {
  display: grid;
  gap: var(--s-4);
}
.associations__head,
.group-card__head,
.member-row,
.actions,
.badges {
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
}
.associations__head,
.group-card__head,
.member-row {
  justify-content: space-between;
}
h2,
h3,
p {
  margin: 0;
}
.muted,
.member-row small {
  color: var(--color-text-muted);
}
.info-card,
.group-card,
.notice {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  padding: var(--s-5);
  box-shadow: var(--shadow-1);
}
.info-card summary {
  cursor: pointer;
  font-weight: 600;
}
.info-card p {
  margin-top: var(--s-3);
  color: var(--color-text-muted);
}
.notice {
  border-color: var(--danger);
  color: var(--danger);
}
.group-card {
  display: grid;
  gap: var(--s-4);
}
.badges,
.actions {
  flex-wrap: wrap;
}
.members {
  display: grid;
  border-top: 1px solid var(--color-border);
}
.member-row {
  padding: var(--s-3) 0;
  border-bottom: 1px solid var(--color-border);
}
.member-row > div {
  display: grid;
  gap: var(--s-1);
}
.empty-members {
  padding: var(--s-3) 0 0;
}
.add-form {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(160px, 0.6fr) auto;
  align-items: end;
  gap: var(--s-3);
}
@media (max-width: 760px) {
  .associations__head,
  .group-card__head,
  .member-row,
  .actions {
    flex-direction: column;
  }
  .add-form {
    grid-template-columns: 1fr;
  }
}
</style>

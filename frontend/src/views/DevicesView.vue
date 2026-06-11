<script setup lang="ts">
/**
 * Devices screen: searchable, filterable, sortable list of all nodes. Cards by
 * default (grouped by room), with an opt-in dense table view for power users
 * (revealed in Advanced mode; collapses back to cards on small screens).
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useNodesStore } from '@/stores/nodes'
import { useUiStore } from '@/stores/ui'
import {
  batteryInfo,
  deviceKinds,
  deviceLocation,
  deviceName,
  deviceStatus,
  filterDevices,
  groupByRoom,
  roomNames,
  searchDevices,
  sortDevices,
  type DeviceKind,
  type DeviceSort,
  type DeviceStatus,
} from '@/devices/model'
import DeviceCard from '@/components/devices/DeviceCard.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'

const nodesStore = useNodesStore()
const ui = useUiStore()
const { advanced } = storeToRefs(ui)

const query = ref('')
const statusFilter = ref<DeviceStatus | 'all'>('all')
const roomFilter = ref<string>('all')
const kindFilter = ref<DeviceKind | 'all'>('all')
const onlyAttention = ref(false)
const sort = ref<DeviceSort>('id')
const grouped = ref(true)
const tableView = ref(false)

const allDevices = computed(() => nodesStore.devices)

const result = computed(() => {
  let list = searchDevices(allDevices.value, query.value)
  list = filterDevices(list, {
    status: statusFilter.value,
    location: roomFilter.value,
    kind: kindFilter.value,
    needsAttention: onlyAttention.value,
  })
  return sortDevices(list, sort.value)
})

const roomGroups = computed(() => groupByRoom(result.value))

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'ready', label: 'Ready' },
  { value: 'asleep', label: 'Asleep' },
  { value: 'dead', label: 'Dead' },
  { value: 'failed', label: 'Failed' },
  { value: 'unknown', label: 'Unknown' },
] as const

const roomOptions = computed(() => [
  { value: 'all', label: 'All rooms' },
  ...roomNames(allDevices.value).map((r) => ({ value: r, label: r })),
])

const KIND_LABEL: Record<DeviceKind, string> = {
  switch: 'Switches',
  dimmer: 'Dimmers',
  cover: 'Covers',
  lock: 'Locks',
  sensor: 'Sensors',
  thermostat: 'Thermostats',
  controller: 'Controllers',
  device: 'Other',
}

const kindOptions = computed(() => [
  { value: 'all', label: 'All types' },
  ...deviceKinds(allDevices.value).map((k) => ({ value: k, label: KIND_LABEL[k] })),
])

const sortOptions = [
  { value: 'id', label: 'Node ID' },
  { value: 'name', label: 'Name' },
  { value: 'location', label: 'Room' },
  { value: 'status', label: 'Status' },
  { value: 'lastSeen', label: 'Last seen' },
] as const

const STATUS_BADGE: Record<DeviceStatus, 'success' | 'info' | 'danger' | 'neutral'> = {
  ready: 'success',
  asleep: 'info',
  dead: 'danger',
  failed: 'danger',
  unknown: 'neutral',
}

const showTable = computed(() => advanced.value && tableView.value)

function setSort(next: DeviceSort) {
  sort.value = next
}

function formatLastSeen(ts?: number): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <section class="devices" :class="{ 'devices--table': showTable }">
    <!-- Toolbar -->
    <div class="devices__toolbar">
      <BaseTextField
        v-model="query"
        type="search"
        placeholder="Search devices…"
        class="devices__search"
      />
      <BaseSelect v-model="sort" :options="sortOptions" aria-label="Sort by" />
      <BaseSelect v-model="statusFilter" :options="statusOptions" aria-label="Filter by status" />
      <BaseSelect v-model="kindFilter" :options="kindOptions" aria-label="Filter by type" />
      <BaseSelect v-model="roomFilter" :options="roomOptions" aria-label="Filter by room" />
      <label class="devices__toggle">
        <BaseSwitch v-model="onlyAttention" label="Needs attention" />
      </label>
      <label class="devices__toggle">
        <BaseSwitch v-model="grouped" label="Group by room" />
      </label>
      <AdvancedOnly>
        <label class="devices__toggle">
          <BaseSwitch v-model="tableView" label="Table view" />
        </label>
      </AdvancedOnly>
    </div>

    <!-- Empty states -->
    <EmptyState
      v-if="allDevices.length === 0"
      icon="🔌"
      title="No devices yet"
      description="Add your first Z-Wave device to get started."
    >
      <template #action>
        <RouterLink to="/add"><BaseButton>Add a device</BaseButton></RouterLink>
      </template>
    </EmptyState>

    <EmptyState
      v-else-if="result.length === 0"
      icon="🔍"
      title="No matching devices"
      description="Try changing your search or filters."
    />

    <!-- Advanced dense table (>=768px); collapses to cards below that width. -->
    <template v-else-if="showTable">
      <div class="devices__table-wrap">
        <table class="devices__table">
          <thead>
            <tr>
              <th><button type="button" @click="setSort('id')">ID</button></th>
              <th><button type="button" @click="setSort('name')">Name</button></th>
              <th><button type="button" @click="setSort('location')">Room</button></th>
              <th>Manufacturer</th>
              <th>Product</th>
              <th>Firmware</th>
              <th><button type="button" @click="setSort('status')">Status</button></th>
              <th>Battery</th>
              <th><button type="button" @click="setSort('lastSeen')">Last seen</button></th>
              <th>Security</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="node in result" :key="node.id">
              <td>{{ node.id }}</td>
              <td>
                <RouterLink :to="`/devices/${node.id}`">{{ deviceName(node) }}</RouterLink>
              </td>
              <td>{{ deviceLocation(node) }}</td>
              <td>{{ node.manufacturer || '—' }}</td>
              <td>{{ node.productLabel || '—' }}</td>
              <td>{{ node.firmwareVersion || '—' }}</td>
              <td>
                <BaseBadge :variant="STATUS_BADGE[deviceStatus(node)]" size="sm">
                  {{ deviceStatus(node) }}
                </BaseBadge>
              </td>
              <td>{{ batteryInfo(node) ? `${batteryInfo(node)!.level}%` : '—' }}</td>
              <td>{{ formatLastSeen(node.lastActive) }}</td>
              <td>{{ node.security || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Card fallback shown on small screens via CSS -->
      <div class="devices__cards">
        <DeviceCard v-for="node in result" :key="node.id" :node="node" />
      </div>
    </template>

    <!-- Grouped cards -->
    <template v-else-if="grouped">
      <section v-for="group in roomGroups" :key="group.location" class="devices__room">
        <h2 class="devices__room-title">
          {{ group.location }}
          <span class="devices__room-count">{{ group.devices.length }}</span>
        </h2>
        <div class="devices__grid">
          <DeviceCard v-for="node in group.devices" :key="node.id" :node="node" />
        </div>
      </section>
    </template>

    <!-- Flat cards -->
    <div v-else class="devices__grid">
      <DeviceCard v-for="node in result" :key="node.id" :node="node" />
    </div>
  </section>
</template>

<style scoped>
.devices {
  display: grid;
  gap: var(--s-5);
}
.devices__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-3);
}
.devices__search {
  flex: 1 1 220px;
  min-width: 180px;
}
.devices__toggle {
  display: inline-flex;
}
.devices__room {
  display: grid;
  gap: var(--s-3);
}
.devices__room-title {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin: 0;
}
.devices__room-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: var(--r-pill);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  font-size: 0.75rem;
}
.devices__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--s-4);
}

/* Table view: cards on mobile, table on >=768px */
.devices__table-wrap {
  display: none;
}
.devices__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--s-4);
}
@media (min-width: 768px) {
  .devices--table .devices__table-wrap {
    display: block;
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--r-md);
  }
  .devices--table .devices__cards {
    display: none;
  }
}
.devices__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  white-space: nowrap;
}
.devices__table th,
.devices__table td {
  padding: var(--s-2) var(--s-3);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}
.devices__table thead th {
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.devices__table th button {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  cursor: pointer;
}
.devices__table th button:hover {
  color: var(--color-text);
}
.devices__table a {
  color: var(--color-primary);
  text-decoration: none;
}
.devices__table tbody tr:hover {
  background: var(--color-surface-2);
}
</style>

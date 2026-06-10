<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { ZwaveNode } from '@/api'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import DeviceCard from '@/components/devices/DeviceCard.vue'
import { useToast } from '@/composables/useToast'
import { writeValue } from '@/devices/control'
import { deviceIcon, deviceName, primaryControl } from '@/devices/model'
import {
  attentionItems,
  favoriteDevices,
  networkSummary,
  roomSummaries,
  type DashboardRoom,
} from '@/dashboard/selectors'
import { useControllerStore } from '@/stores/controller'
import { useFavoritesStore } from '@/stores/favorites'
import { useNodesStore } from '@/stores/nodes'

const nodes = useNodesStore()
const controller = useControllerStore()
const favorites = useFavoritesStore()
const toast = useToast()

const busyRoom = ref<string | null>(null)

const devices = computed(() => nodes.devices)
const favoriteCards = computed(() => favoriteDevices(devices.value, favorites.orderedIds))
const rooms = computed(() => roomSummaries(devices.value))
const needsAttention = computed(() => attentionItems(devices.value))
const summary = computed(() =>
  networkSummary(devices.value, {
    status: controller.status,
    controllerStatus: controller.controllerStatus,
  }),
)

function toggleFavorite(node: ZwaveNode) {
  favorites.toggle(node.id)
}

async function setRoomPower(room: DashboardRoom, on: boolean) {
  const targets = room.devices
    .map((node) => ({ node, control: primaryControl(node) }))
    .filter((target): target is { node: ZwaveNode; control: NonNullable<ReturnType<typeof primaryControl>> } =>
      Boolean(target.control),
    )
  if (!targets.length || busyRoom.value) return

  busyRoom.value = room.location
  const results = await Promise.all(
    targets.map(async ({ control }) => {
      try {
        return await writeValue(control.write, on ? control.onValue : control.offValue)
      } catch {
        return { success: false, message: 'Request failed' }
      }
    }),
  )
  busyRoom.value = null

  const failures = results.filter((result) => !result.success)
  if (failures.length) {
    toast.error(`Couldn't turn ${on ? 'on' : 'off'} ${failures.length} device${failures.length === 1 ? '' : 's'}`)
  } else {
    toast.success(`${room.location} turned ${on ? 'on' : 'off'}`)
  }
}
</script>

<template>
  <section class="dashboard">
    <div class="dashboard__hero">
      <div>
        <p class="dashboard__eyebrow">Home</p>
        <h1>Dashboard</h1>
        <p class="dashboard__subtitle">Favorites, rooms, and network health at a glance.</p>
      </div>
      <RouterLink to="/network" class="network-card" aria-label="Open network overview">
        <span class="network-card__label">Network at a glance</span>
        <span class="network-card__stats">
          <strong>{{ summary.onlineCount }}</strong> / {{ summary.totalDevices }} online
        </span>
        <span class="network-card__status">
          <StatusDot :status="controller.isConnected ? 'ok' : 'danger'" />
          {{ summary.controllerStatus }}
        </span>
      </RouterLink>
    </div>

    <BaseCard v-if="devices.length === 0">
      <EmptyState title="No devices yet" description="Add your first Z-Wave device to start building your dashboard." icon="➕">
        <template #action>
          <RouterLink to="/add" class="dashboard__link-action">
            <BaseButton>Add a device</BaseButton>
          </RouterLink>
        </template>
      </EmptyState>
    </BaseCard>

    <template v-else>
      <section v-if="needsAttention.length" class="dashboard__section" aria-labelledby="attention-title">
        <div class="dashboard__section-head">
          <div>
            <p class="dashboard__eyebrow">Needs attention</p>
            <h2 id="attention-title">Review these devices</h2>
          </div>
          <BaseBadge variant="warning" size="sm">{{ needsAttention.length }}</BaseBadge>
        </div>
        <div class="attention-list">
          <RouterLink
            v-for="item in needsAttention"
            :key="item.node.id"
            :to="`/devices/${item.node.id}`"
            class="attention-item"
          >
            <span class="attention-item__icon" aria-hidden="true">{{ deviceIcon(item.node) }}</span>
            <span class="attention-item__body">
              <strong>{{ deviceName(item.node) }}</strong>
              <span>{{ item.reasons.join(' · ') }}</span>
            </span>
            <span class="attention-item__cta">Review</span>
          </RouterLink>
        </div>
      </section>

      <section class="dashboard__section" aria-labelledby="favorites-title">
        <div class="dashboard__section-head">
          <div>
            <p class="dashboard__eyebrow">Favorites</p>
            <h2 id="favorites-title">Pinned devices</h2>
          </div>
          <BaseBadge variant="primary" size="sm">{{ favoriteCards.length }}</BaseBadge>
        </div>

        <div v-if="favoriteCards.length" class="device-grid">
          <DeviceCard v-for="node in favoriteCards" :key="node.id" :node="node">
            <template #actions>
              <button
                class="favorite-button favorite-button--active"
                type="button"
                :aria-label="`Unpin ${deviceName(node)}`"
                @click.stop.prevent="toggleFavorite(node)"
              >
                ★
              </button>
            </template>
          </DeviceCard>
        </div>
        <BaseCard v-else>
          <EmptyState title="No favorites yet" description="Pin devices from the room cards below for quicker access." icon="☆" />
        </BaseCard>
      </section>

      <section class="dashboard__section" aria-labelledby="rooms-title">
        <div class="dashboard__section-head">
          <div>
            <p class="dashboard__eyebrow">Rooms</p>
            <h2 id="rooms-title">Locations</h2>
          </div>
          <BaseBadge variant="neutral" size="sm">{{ rooms.length }}</BaseBadge>
        </div>

        <BaseCard v-if="rooms.length === 0">
          <EmptyState title="No rooms yet" description="Assign device locations to see room summaries here." icon="🏠" />
        </BaseCard>

        <div v-else class="room-grid">
          <BaseCard v-for="room in rooms" :key="room.location" class="room-card">
            <template #header>
              <div class="room-card__header">
                <span>{{ room.location }}</span>
                <BaseBadge variant="neutral" size="sm">{{ room.count }} device{{ room.count === 1 ? '' : 's' }}</BaseBadge>
              </div>
            </template>

            <div class="room-card__devices">
              <div v-for="node in room.devices.slice(0, 4)" :key="node.id" class="room-card__device">
                <span class="room-card__device-name">
                  <span aria-hidden="true">{{ deviceIcon(node) }}</span>
                  {{ deviceName(node) }}
                </span>
                <button
                  class="favorite-button"
                  :class="{ 'favorite-button--active': favorites.isFavorite(node.id) }"
                  type="button"
                  :aria-label="`${favorites.isFavorite(node.id) ? 'Unpin' : 'Pin'} ${deviceName(node)}`"
                  @click="toggleFavorite(node)"
                >
                  {{ favorites.isFavorite(node.id) ? '★' : '☆' }}
                </button>
              </div>
              <p v-if="room.count > 4" class="room-card__more">+ {{ room.count - 4 }} more</p>
            </div>

            <template v-if="room.controllableCount" #footer>
              <div class="room-card__actions">
                <BaseButton
                  variant="secondary"
                  size="sm"
                  :loading="busyRoom === room.location"
                  @click="setRoomPower(room, true)"
                >
                  All on
                </BaseButton>
                <BaseButton
                  variant="ghost"
                  size="sm"
                  :disabled="busyRoom === room.location"
                  @click="setRoomPower(room, false)"
                >
                  All off
                </BaseButton>
              </div>
            </template>
          </BaseCard>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: var(--s-6);
  max-width: 1200px;
}

.dashboard__hero,
.dashboard__section-head {
  display: grid;
  gap: var(--s-4);
}

.dashboard__hero {
  align-items: stretch;
}

.dashboard h1,
.dashboard h2,
.dashboard p {
  margin: 0;
}

.dashboard h1 {
  font-size: clamp(1.5rem, 3vw, 2rem);
}

.dashboard h2 {
  font-size: 1.25rem;
}

.dashboard__eyebrow {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dashboard__subtitle,
.room-card__more {
  color: var(--color-text-muted);
}

.dashboard__section {
  display: grid;
  gap: var(--s-4);
}

.network-card,
.attention-item,
.dashboard__link-action {
  color: var(--color-text);
  text-decoration: none;
}

.network-card {
  display: grid;
  gap: var(--s-2);
  padding: var(--s-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-1);
}

.network-card:hover,
.attention-item:hover {
  border-color: var(--color-primary);
}

.network-card:focus-visible,
.attention-item:focus-visible,
.dashboard__link-action:focus-visible,
.favorite-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.network-card__label,
.network-card__status,
.attention-item__body span,
.room-card__more {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.network-card__stats strong {
  font-size: 1.5rem;
}

.network-card__status {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  text-transform: capitalize;
}

.attention-list,
.room-card__devices {
  display: grid;
  gap: var(--s-2);
}

.attention-item {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
}

.attention-item__icon {
  font-size: 1.25rem;
}

.attention-item__body {
  display: grid;
  min-width: 0;
}

.attention-item__cta {
  margin-left: auto;
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 700;
}

.device-grid,
.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--s-4);
}

.room-card__header,
.room-card__device,
.room-card__actions {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}

.room-card__header,
.room-card__device {
  justify-content: space-between;
}

.room-card__device-name {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-card__actions {
  flex-wrap: wrap;
}

.favorite-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--color-border);
  border-radius: var(--r-pill);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
}

.favorite-button--active {
  color: var(--warn);
}

@media (min-width: 640px) {
  .dashboard__hero,
  .dashboard__section-head {
    grid-template-columns: 1fr auto;
    align-items: center;
  }

  .network-card {
    min-width: 260px;
  }
}
</style>

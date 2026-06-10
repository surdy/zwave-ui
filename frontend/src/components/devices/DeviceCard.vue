<script setup lang="ts">
/**
 * Device summary card with a primary quick action, shared by the device list
 * and the dashboard. Tapping the card opens the device detail; the quick-action
 * control actuates the device without navigating.
 */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { ZwaveNode } from '@/api'
import {
  batteryInfo,
  controlIsOn,
  deviceIcon,
  deviceLocation,
  deviceName,
  deviceStatus,
  primaryControl,
  type DeviceStatus,
} from '@/devices/model'
import { writeValue } from '@/devices/control'
import { useToast } from '@/composables/useToast'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'

const props = defineProps<{ node: ZwaveNode }>()
const toast = useToast()
const busy = ref(false)

const name = computed(() => deviceName(props.node))
const location = computed(() => deviceLocation(props.node))
const icon = computed(() => deviceIcon(props.node))
const status = computed(() => deviceStatus(props.node))
const battery = computed(() => batteryInfo(props.node))
const control = computed(() => primaryControl(props.node))

const currentValue = computed(() => {
  const c = control.value
  if (!c?.read) return undefined
  return props.node.values?.[c.read.id]?.value
})
const isOn = computed(() => (control.value ? controlIsOn(control.value, currentValue.value) : false))

const STATUS_BADGE: Record<DeviceStatus, { variant: 'success' | 'info' | 'danger' | 'neutral'; label: string }> = {
  ready: { variant: 'success', label: 'Ready' },
  asleep: { variant: 'info', label: 'Asleep' },
  dead: { variant: 'danger', label: 'Dead' },
  failed: { variant: 'danger', label: 'Failed' },
  unknown: { variant: 'neutral', label: 'Unknown' },
}
const statusBadge = computed(() => STATUS_BADGE[status.value])

const controlLabel = computed(() => {
  if (!control.value) return ''
  switch (control.value.kind) {
    case 'cover':
      return isOn.value ? 'Open' : 'Closed'
    case 'lock':
      return isOn.value ? 'Locked' : 'Unlocked'
    default:
      return isOn.value ? 'On' : 'Off'
  }
})

async function toggle() {
  const c = control.value
  if (!c || busy.value) return
  busy.value = true
  const target = isOn.value ? c.offValue : c.onValue
  try {
    const res = await writeValue(c.write, target)
    if (!res.success) toast.error(res.message || `Couldn't control ${name.value}`)
  } catch {
    toast.error(`Couldn't reach ${name.value}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <RouterLink :to="`/devices/${node.id}`" class="card" :class="{ 'card--attention': status === 'dead' || status === 'failed' }">
    <div class="card__head">
      <span class="card__icon" aria-hidden="true">{{ icon }}</span>
      <div class="card__id">
        <span class="card__name">{{ name }}</span>
        <span class="card__loc">{{ location }}</span>
      </div>
      <slot name="actions" />
    </div>

    <div class="card__meta">
      <BaseBadge :variant="statusBadge.variant" size="sm">{{ statusBadge.label }}</BaseBadge>
      <span v-if="battery" class="card__battery" :class="{ 'card__battery--low': battery.low }">
        🔋 {{ battery.level }}%
      </span>
    </div>

    <div v-if="control" class="card__control" @click.stop.prevent>
      <BaseSwitch :model-value="isOn" :disabled="busy" :label="controlLabel" @update:model-value="toggle" />
    </div>
  </RouterLink>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-1);
  text-decoration: none;
  color: var(--color-text);
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}
.card:hover {
  border-color: var(--color-primary);
}
.card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.card--attention {
  border-color: var(--danger);
}
.card__head {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.card__icon {
  font-size: 1.5rem;
  line-height: 1;
}
.card__id {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.card__name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card__loc {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}
.card__meta {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.card__battery {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}
.card__battery--low {
  color: var(--warn);
  font-weight: 600;
}
.card__control {
  margin-top: auto;
}
</style>

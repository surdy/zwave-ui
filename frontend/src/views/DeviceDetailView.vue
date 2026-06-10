<script setup lang="ts">
/**
 * Device detail placeholder. Full overview + capability-rendered controls land
 * in #9 and #10; for now this confirms routing and shows core device facts.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useNodesStore } from '@/stores/nodes'
import { batteryInfo, deviceIcon, deviceLocation, deviceName, deviceStatus } from '@/devices/model'
import BaseBadge from '@/components/base/BaseBadge.vue'
import EmptyState from '@/components/base/EmptyState.vue'

const route = useRoute()
const nodesStore = useNodesStore()
const { byId } = storeToRefs(nodesStore)

const nodeId = computed(() => Number(route.params.id))
const node = computed(() => byId.value[nodeId.value])
</script>

<template>
  <section v-if="node" class="detail">
    <RouterLink to="/devices" class="detail__back">← All devices</RouterLink>
    <header class="detail__head">
      <span class="detail__icon" aria-hidden="true">{{ deviceIcon(node) }}</span>
      <div>
        <h1 class="detail__name">{{ deviceName(node) }}</h1>
        <p class="detail__loc">{{ deviceLocation(node) }} · Node {{ node.id }}</p>
      </div>
    </header>

    <dl class="detail__facts">
      <div>
        <dt>Status</dt>
        <dd><BaseBadge size="sm">{{ deviceStatus(node) }}</BaseBadge></dd>
      </div>
      <div v-if="batteryInfo(node)">
        <dt>Battery</dt>
        <dd>{{ batteryInfo(node)!.level }}%</dd>
      </div>
      <div v-if="node.manufacturer">
        <dt>Manufacturer</dt>
        <dd>{{ node.manufacturer }}</dd>
      </div>
      <div v-if="node.productLabel">
        <dt>Product</dt>
        <dd>{{ node.productLabel }}</dd>
      </div>
      <div v-if="node.firmwareVersion">
        <dt>Firmware</dt>
        <dd>{{ node.firmwareVersion }}</dd>
      </div>
    </dl>

    <p class="detail__note">Full controls &amp; configuration arrive in #9 and #10.</p>
  </section>

  <EmptyState
    v-else
    icon="❓"
    title="Device not found"
    :description="`No device with id ${nodeId} is on the network.`"
  />
</template>

<style scoped>
.detail {
  display: grid;
  gap: var(--s-5);
  max-width: 720px;
}
.detail__back {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.875rem;
}
.detail__back:hover {
  color: var(--color-text);
}
.detail__head {
  display: flex;
  align-items: center;
  gap: var(--s-4);
}
.detail__icon {
  font-size: 2.5rem;
  line-height: 1;
}
.detail__name {
  margin: 0;
  font-size: 1.5rem;
}
.detail__loc {
  margin: var(--s-1) 0 0;
  color: var(--color-text-muted);
}
.detail__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--s-4);
  margin: 0;
}
.detail__facts dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}
.detail__facts dd {
  margin: var(--s-1) 0 0;
  font-weight: 600;
}
.detail__note {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import type { NetworkCounts } from '@/network/health'
import type { ZwaveNode } from '@/api'
import { deviceName, deviceStatus } from '@/devices/model'

const props = defineProps<{
  counts: NetworkCounts
  problemNodes: ZwaveNode[]
  controllerStatus: string
  rfRegion: string
  rssiSummary?: string
}>()

const healthVariant = computed(() => (props.counts.dead + props.counts.failed > 0 ? 'danger' : 'success'))
</script>

<template>
  <section class="health-summary">
    <div class="health-summary__stats">
      <BaseCard>
        <div class="stat"><b>{{ counts.total }}</b><span>Total nodes</span></div>
      </BaseCard>
      <BaseCard>
        <div class="stat stat--ok"><b>{{ counts.online }}</b><span>Online</span></div>
      </BaseCard>
      <BaseCard>
        <div class="stat stat--warn"><b>{{ counts.asleep }}</b><span>Asleep</span></div>
      </BaseCard>
      <BaseCard>
        <div class="stat stat--danger"><b>{{ counts.dead + counts.failed }}</b><span>Dead / failed</span></div>
      </BaseCard>
    </div>

    <BaseCard>
      <template #header>
        <div class="health-summary__header">
          <span>Controller</span>
          <BaseBadge :variant="healthVariant">{{ controllerStatus }}</BaseBadge>
        </div>
      </template>
      <dl class="health-summary__facts">
        <div><dt>RF region</dt><dd>{{ rfRegion }}</dd></div>
        <div><dt>Background RSSI</dt><dd>{{ rssiSummary || 'Waiting for statistics…' }}</dd></div>
      </dl>
    </BaseCard>

    <BaseCard>
      <template #header>Problem nodes</template>
      <div v-if="problemNodes.length" class="problem-list">
        <RouterLink
          v-for="node in problemNodes"
          :key="node.id"
          class="problem-list__item"
          :to="{ name: 'device-detail', params: { id: node.id } }"
        >
          <span>{{ deviceName(node) }}</span>
          <BaseBadge variant="danger" size="sm">{{ deviceStatus(node) }}</BaseBadge>
        </RouterLink>
      </div>
      <p v-else class="muted">No dead or failed nodes.</p>
    </BaseCard>
  </section>
</template>

<style scoped>
.health-summary,
.health-summary__stats {
  display: grid;
  gap: var(--s-4);
}
.health-summary__stats {
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
.stat {
  display: grid;
  gap: var(--s-1);
}
.stat b {
  font-size: 1.75rem;
  color: var(--color-text);
}
.stat span,
.muted,
dt {
  color: var(--color-text-muted);
}
.stat--ok b { color: var(--ok); }
.stat--warn b { color: var(--warn); }
.stat--danger b { color: var(--danger); }
.health-summary__header,
.problem-list__item,
.health-summary__facts > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
}
.health-summary__facts {
  display: grid;
  gap: var(--s-3);
  margin: 0;
}
dt,
dd { margin: 0; }
dd { font-weight: 600; }
.problem-list {
  display: grid;
  gap: var(--s-2);
}
.problem-list__item {
  padding: var(--s-2);
  border-radius: var(--r-md);
  color: var(--color-text);
  text-decoration: none;
}
.problem-list__item:hover { background: var(--color-surface-2); }
</style>

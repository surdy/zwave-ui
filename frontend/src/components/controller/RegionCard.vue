<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseNumberField from '@/components/base/BaseNumberField.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import { RF_REGIONS, type RFRegionValue } from '@/network/controller-maintenance'

const props = defineProps<{
  currentRegion?: number | string
  powerlevel?: number | string
  measured0dBm?: number | string
  maxLongRangePowerlevel?: number | string
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  setRegion: [region: number]
  setPowerlevel: [powerlevel: number, measured0dBm: number]
  setMaxLongRange: [powerlevel: number]
}>()

const selectedRegion = ref<string | number>('')
const power = ref<number | null>(null)
const measured = ref<number | null>(null)
const maxLR = ref<number | null>(null)

watch(
  () => props.currentRegion,
  (value) => {
    selectedRegion.value = value === undefined ? '' : Number(value)
  },
  { immediate: true },
)
watch(
  () => props.powerlevel,
  (value) => {
    power.value = toNumber(value)
  },
  { immediate: true },
)
watch(
  () => props.measured0dBm,
  (value) => {
    measured.value = toNumber(value)
  },
  { immediate: true },
)
watch(
  () => props.maxLongRangePowerlevel,
  (value) => {
    maxLR.value = toNumber(value)
  },
  { immediate: true },
)

const regionOptions = computed(() =>
  RF_REGIONS.map((region) => ({
    label: region.label,
    value: region.value,
    disabled: 'disabled' in region ? region.disabled : false,
  })),
)
const currentRegionLabel = computed(() => RF_REGIONS.find((region) => region.value === Number(props.currentRegion))?.label ?? 'Unknown')
const canSetPower = computed(() => power.value !== null && measured.value !== null)

function setRegion() {
  if (selectedRegion.value !== '') emit('setRegion', Number(selectedRegion.value) as RFRegionValue)
}

function setPower() {
  if (power.value !== null && measured.value !== null) emit('setPowerlevel', power.value, measured.value)
}

function setLongRange() {
  if (maxLR.value !== null) emit('setMaxLongRange', maxLR.value)
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}
</script>

<template>
  <BaseCard>
    <template #header>
      <div class="card-title">
        <span>RF region / powerlevel</span>
        <BaseBadge variant="expert">Expert</BaseBadge>
      </div>
    </template>

    <p class="muted">Changing radio region or TX power can make devices unreachable or violate local regulations. Confirm values before applying.</p>

    <dl class="facts">
      <div><dt>Current RF region</dt><dd>{{ currentRegionLabel }}</dd></div>
      <div><dt>Powerlevel</dt><dd>{{ powerlevel ?? 'Unknown' }}</dd></div>
      <div><dt>Measured 0 dBm</dt><dd>{{ measured0dBm ?? 'Unknown' }}</dd></div>
      <div><dt>Max LR power</dt><dd>{{ maxLongRangePowerlevel ?? 'Unknown' }}</dd></div>
    </dl>

    <div class="form-grid">
      <BaseSelect v-model="selectedRegion" label="RF region" :options="regionOptions" :disabled="disabled || loading" />
      <BaseButton variant="danger" :loading="loading" :disabled="disabled || selectedRegion === ''" @click="setRegion">Apply region</BaseButton>
      <BaseNumberField v-model="power" label="Powerlevel" :disabled="disabled || loading" unit="dBm" />
      <BaseNumberField v-model="measured" label="Measured 0 dBm" :disabled="disabled || loading" unit="dBm" />
      <BaseButton variant="danger" :loading="loading" :disabled="disabled || !canSetPower" @click="setPower">Apply powerlevel</BaseButton>
      <BaseNumberField v-model="maxLR" label="Max long range power" :disabled="disabled || loading" unit="dBm" />
      <BaseButton variant="danger" :loading="loading" :disabled="disabled || maxLR === null" @click="setLongRange">Apply LR max</BaseButton>
    </div>
  </BaseCard>
</template>

<style scoped>
.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
}
.muted {
  margin: 0 0 var(--s-4);
  color: var(--color-text-muted);
}
.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s-3);
  margin: 0 0 var(--s-5);
}
.facts div {
  padding: var(--s-3);
  background: var(--color-surface-2);
  border-radius: var(--r-md);
}
dt {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}
dd {
  margin: var(--s-1) 0 0;
  font-weight: 700;
}
.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--s-3);
}
.form-grid > :nth-child(3) {
  grid-column: 1;
}
@media (max-width: 720px) {
  .facts,
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>

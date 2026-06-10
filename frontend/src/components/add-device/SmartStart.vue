<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import AdvancedOnly from '@/components/base/AdvancedOnly.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import {
  buildProvisioningEntry,
  getProvisioningEntries,
  isBarcodeDetectorSupported,
  normalizeParsedQr,
  parseQRCodeString,
  provisionSmartStartNode,
  provisioningStatusLabel,
  SecurityClass,
  unprovisionSmartStartNode,
  type NormalizedSmartStartQr,
  type SecurityClassValue,
  type SmartStartProvisioningEntry,
} from '@/devices/smartstart'
import { useUiStore } from '@/stores/ui'

const SmartStartScanner = defineAsyncComponent(() => import('./SmartStartScanner.vue'))

const toast = useToast()
const { confirm } = useConfirm()
const ui = useUiStore()

const qrInput = ref('')
const name = ref('')
const location = ref('')
const parsed = ref<NormalizedSmartStartQr>()
const entries = ref<SmartStartProvisioningEntry[]>([])
const selectedSecurityClasses = ref<SecurityClassValue[]>([])
const scannerOpen = ref(false)
const busy = ref(false)
const loadingEntries = ref(false)

const barcodeSupported = computed(() => isBarcodeDetectorSupported(window as unknown as { BarcodeDetector?: unknown }))
const canProvision = computed(() => Boolean(parsed.value?.dsk && !busy.value))
const securityOptions: { id: SecurityClassValue; title: string; hint: string }[] = [
  { id: SecurityClass.S2AccessControl, title: 'S2 Access Control', hint: 'Locks, garage doors, and access devices.' },
  { id: SecurityClass.S2Authenticated, title: 'S2 Authenticated', hint: 'Lighting, sensors, and security systems.' },
  { id: SecurityClass.S2Unauthenticated, title: 'S2 Unauthenticated', hint: 'Encrypted without device identity verification.' },
  { id: SecurityClass.S0Legacy, title: 'S0 Legacy', hint: 'Only for older devices that request S0.' },
]

onMounted(() => {
  void loadEntries()
})

async function parseInput() {
  const value = qrInput.value.trim()
  if (!value) return toast.warning('Paste a QR code string or DSK first.')

  busy.value = true
  try {
    const response = await parseQRCodeString(value)
    if (!response.success) throw new Error(response.message || 'Could not parse QR code')
    setParsed(normalizeParsedQr(response.result))
    toast.success('QR code parsed. Review the details before provisioning.')
  } catch (error) {
    if (looksLikeDsk(value)) {
      setParsed({ dsk: value, exists: false, securityClasses: [], requestedSecurityClasses: [] })
      toast.info('Using manual DSK entry. Choose security classes before provisioning.')
    } else {
      toast.error(error instanceof Error ? error.message : 'Could not parse QR code')
    }
  } finally {
    busy.value = false
  }
}

async function provision() {
  if (!parsed.value) return
  const message = parsed.value.exists
    ? 'This DSK already appears to be provisioned. Update the existing provisioning entry?'
    : 'Add this device to the Smart Start provisioning list? Power it on near the controller to join automatically.'
  if (!(await confirm({ title: 'Provision Smart Start device?', message, confirmText: 'Provision' }))) return

  busy.value = true
  try {
    const entry = buildProvisioningEntry(parsed.value, {
      name: name.value,
      location: location.value,
      securityClasses: selectedSecurityClasses.value,
    })
    const response = await provisionSmartStartNode(entry)
    if (!response.success) throw new Error(response.message || 'Could not provision Smart Start entry')
    toast.success('Provisioning entry saved')
    resetForm()
    await loadEntries()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not provision Smart Start entry')
  } finally {
    busy.value = false
  }
}

async function loadEntries() {
  loadingEntries.value = true
  try {
    const response = await getProvisioningEntries()
    if (!response.success) throw new Error(response.message || 'Could not load provisioning entries')
    entries.value = response.result ?? []
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not load provisioning entries')
  } finally {
    loadingEntries.value = false
  }
}

async function removeEntry(entry: SmartStartProvisioningEntry) {
  const label = entry.name || entry.dsk
  if (
    !(await confirm({
      danger: true,
      title: 'Remove provisioning entry?',
      message: `Remove ${label} from Smart Start provisioning? This does not exclude an already-included node.`,
      confirmText: 'Remove',
    }))
  ) {
    return
  }

  busy.value = true
  try {
    const response = await unprovisionSmartStartNode(entry.dsk || entry.nodeId || '')
    if (!response.success) throw new Error(response.message || 'Could not remove provisioning entry')
    entries.value = entries.value.filter((item) => item !== entry)
    toast.success('Provisioning entry removed')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not remove provisioning entry')
  } finally {
    busy.value = false
  }
}

function setParsed(next: NormalizedSmartStartQr) {
  parsed.value = next
  selectedSecurityClasses.value = next.securityClasses.length ? [...next.securityClasses] : [...next.requestedSecurityClasses]
}

function onScanned(value: string) {
  scannerOpen.value = false
  qrInput.value = value
  void parseInput()
}

function toggleSecurityClass(id: SecurityClassValue, checked: boolean) {
  selectedSecurityClasses.value = checked
    ? [...new Set([...selectedSecurityClasses.value, id])]
    : selectedSecurityClasses.value.filter((item) => item !== id)
}

function resetForm() {
  qrInput.value = ''
  name.value = ''
  location.value = ''
  parsed.value = undefined
  selectedSecurityClasses.value = []
}

function formatList(values?: number[]): string {
  return values?.length ? values.map(securityClassLabel).join(', ') : 'None'
}

function securityClassLabel(value: number): string {
  return securityOptions.find((option) => option.id === value)?.title ?? `Class ${value}`
}

function statusVariant(entry: SmartStartProvisioningEntry): 'success' | 'warning' | 'neutral' {
  if (typeof entry.nodeId === 'number') return 'success'
  if (entry.status === 1) return 'neutral'
  return 'warning'
}

function looksLikeDsk(value: string): boolean {
  return /^\d{5}(?:-\d{5}){7}$/.test(value)
}
</script>

<template>
  <section v-if="!ui.advanced" class="smart-start">
    <div class="card locked">
      <BaseBadge variant="advanced">Advanced</BaseBadge>
      <h2>Smart Start provisioning</h2>
      <p>Turn on Advanced mode to scan Smart Start QR codes and manage the provisioning list.</p>
    </div>
  </section>

  <AdvancedOnly v-else>
    <section class="smart-start">
      <header class="hero card">
        <div>
          <div class="title-row">
            <BaseBadge variant="advanced">Advanced</BaseBadge>
            <h2>Scan to add — the easy way</h2>
          </div>
          <p>
            Smart Start lets modern Z-Wave devices join securely on their own. Scan or paste the QR code, save it to the provisioning list, then
            power on the device near the controller.
          </p>
        </div>
        <BaseButton variant="secondary" :loading="loadingEntries" @click="loadEntries">Refresh list</BaseButton>
      </header>

      <section class="grid">
        <article class="card flow-card">
          <div class="step-heading">
            <span class="step-num">1</span>
            <div>
              <h3>Scan or paste the code</h3>
              <p>Camera scanning uses the native browser BarcodeDetector API when available. Paste entry always works as a fallback.</p>
            </div>
          </div>

          <SmartStartScanner v-if="scannerOpen" @scanned="onScanned" @error="toast.warning" @close="scannerOpen = false" />
          <div v-else class="scan-placeholder">
            <span aria-hidden="true">▣</span>
            <p>{{ barcodeSupported ? 'Open the camera to scan a QR code.' : 'Camera QR scanning is unavailable in this browser.' }}</p>
          </div>

          <div class="actions">
            <BaseButton :disabled="!barcodeSupported || busy" @click="scannerOpen = true">Scan QR code</BaseButton>
            <BaseButton variant="secondary" :disabled="busy" @click="scannerOpen = false">Use paste / DSK</BaseButton>
          </div>

          <label class="text-area-field">
            <span>QR code string or DSK</span>
            <textarea v-model="qrInput" :disabled="busy" rows="4" placeholder="Paste 90… Smart Start QR code string or 12345-… DSK" />
          </label>
          <BaseButton :loading="busy" :disabled="!qrInput.trim()" @click="parseInput">Parse and review</BaseButton>
        </article>

        <article class="card flow-card">
          <div class="step-heading">
            <span class="step-num">2</span>
            <div>
              <h3>Confirm provisioning</h3>
              <p>Review the fingerprint, add optional details, and choose which requested security classes to grant.</p>
            </div>
          </div>

          <EmptyState v-if="!parsed" icon="🔎" title="No QR parsed yet" description="Parse a QR string or DSK to review provisioning details." />
          <template v-else>
            <dl class="facts">
              <div><dt>DSK</dt><dd>{{ parsed.dsk }}</dd></div>
              <div><dt>Manufacturer ID</dt><dd>{{ parsed.manufacturerId ?? 'Unknown' }}</dd></div>
              <div><dt>Product type</dt><dd>{{ parsed.productType ?? 'Unknown' }}</dd></div>
              <div><dt>Product ID</dt><dd>{{ parsed.productId ?? 'Unknown' }}</dd></div>
              <div><dt>App version</dt><dd>{{ parsed.applicationVersion ?? 'Unknown' }}</dd></div>
              <div><dt>Existing</dt><dd>{{ parsed.exists ? 'Already provisioned' : 'New entry' }}</dd></div>
            </dl>

            <div class="name-grid">
              <BaseTextField v-model="name" label="Name (optional)" placeholder="Bedroom switch" :disabled="busy" />
              <BaseTextField v-model="location" label="Location (optional)" placeholder="Bedroom" :disabled="busy" />
            </div>

            <div class="security-card">
              <strong>Grant security classes</strong>
              <p>Requested: {{ formatList(parsed.requestedSecurityClasses) }}</p>
              <label v-for="item in securityOptions" :key="item.id" class="check-row">
                <input
                  type="checkbox"
                  :checked="selectedSecurityClasses.includes(item.id)"
                  :disabled="busy || (parsed.requestedSecurityClasses.length > 0 && !parsed.requestedSecurityClasses.includes(item.id))"
                  @change="toggleSecurityClass(item.id, ($event.target as HTMLInputElement).checked)"
                >
                <span>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.hint }}</small>
                </span>
              </label>
            </div>

            <div class="actions">
              <BaseButton :disabled="!canProvision" :loading="busy" @click="provision">Confirm & provision</BaseButton>
              <BaseButton variant="ghost" :disabled="busy" @click="resetForm">Clear</BaseButton>
            </div>
          </template>
        </article>
      </section>

      <section class="card list-card">
        <div class="section-head">
          <div>
            <h3>Provisioning entries</h3>
            <p>Pending entries join automatically when the matching device powers on. Included entries stay for reference.</p>
          </div>
          <BaseBadge variant="info">{{ entries.length }} Smart Start</BaseBadge>
        </div>

        <EmptyState v-if="entries.length === 0" icon="⚡" title="No provisioning entries" description="Scan or paste a QR code to add one." />
        <div v-else class="entry-list">
          <article v-for="entry in entries" :key="entry.dsk || entry.nodeId" class="entry">
            <div class="entry__main">
              <div>
                <strong>{{ entry.name || entry.label || 'Unnamed device' }}</strong>
                <p>{{ entry.location || entry.manufacturer || entry.description || 'No location set' }}</p>
              </div>
              <BaseBadge :variant="statusVariant(entry)">
                <StatusDot :status="entry.nodeId ? 'ok' : 'info'" />
                {{ provisioningStatusLabel(entry) }}
              </BaseBadge>
            </div>
            <dl class="entry__facts">
              <div><dt>DSK</dt><dd>{{ entry.dsk }}</dd></div>
              <div><dt>Security</dt><dd>{{ formatList(entry.securityClasses) }}</dd></div>
              <div><dt>Protocol</dt><dd>{{ entry.protocol ?? entry.supportedProtocols?.[0] ?? 'Z-Wave' }}</dd></div>
            </dl>
            <div class="actions">
              <BaseButton variant="danger" size="sm" :disabled="busy" @click="removeEntry(entry)">Remove</BaseButton>
            </div>
          </article>
        </div>
      </section>
    </section>
  </AdvancedOnly>
</template>

<style scoped>
.smart-start,
.flow-card,
.list-card,
.entry-list {
  display: grid;
  gap: var(--s-5);
}
.card {
  padding: var(--s-5);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-1);
}
.hero,
.section-head,
.entry__main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--s-4);
}
.title-row,
.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s-3);
}
.grid,
.name-grid {
  display: grid;
  gap: var(--s-4);
}
.step-heading {
  display: flex;
  gap: var(--s-3);
  align-items: flex-start;
}
.step-heading > div {
  display: grid;
  gap: var(--s-2);
}
.step-num {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  flex: none;
  border-radius: var(--r-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
  font-weight: 800;
}
.scan-placeholder {
  display: grid;
  place-items: center;
  gap: var(--s-2);
  min-height: 14rem;
  padding: var(--s-5);
  border: 2px dashed var(--color-border);
  border-radius: var(--r-lg);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  text-align: center;
}
.scan-placeholder span {
  font-size: 3rem;
}
.text-area-field,
.security-card,
.entry {
  display: grid;
  gap: var(--s-3);
}
.text-area-field span {
  font-weight: 600;
  color: var(--color-text);
}
textarea {
  width: 100%;
  resize: vertical;
  padding: var(--s-3);
  font: inherit;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
}
.facts,
.entry__facts {
  display: grid;
  gap: var(--s-3);
  margin: 0;
}
.facts {
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
}
.entry__facts {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
dt {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
dd {
  margin: var(--s-1) 0 0;
  overflow-wrap: anywhere;
  font-weight: 600;
}
.security-card,
.entry {
  padding: var(--s-4);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  background: var(--color-surface-2);
}
.check-row {
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  cursor: pointer;
}
.check-row input {
  margin-top: 0.2rem;
}
.check-row span {
  display: grid;
  gap: var(--s-1);
}
h2,
h3,
p {
  margin: 0;
}
p,
small {
  color: var(--color-text-muted);
}
.locked {
  display: grid;
  gap: var(--s-3);
}
@media (min-width: 860px) {
  .grid,
  .name-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px) {
  .hero,
  .section-head,
  .entry__main {
    flex-direction: column;
  }
}
</style>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Channel, SocketEvent } from '@/api/events'
import { zwaveSocket } from '@/api/socket'
import { useToast } from '@/composables/useToast'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import StatusDot from '@/components/base/StatusDot.vue'
import {
  LOG_LEVELS,
  appendLines,
  cancelDebug,
  computeWindow,
  createLineAccumulator,
  fetchDebugStatus,
  filterLines,
  linesToBlob,
  parseLogLine,
  startDebug,
  stopDebug,
  type LogLevel,
  type LogLevelFilter,
  type ParsedLogLine,
} from '@/diagnostics/debugLog'

const MAX_LINES = 5000
const ROW_HEIGHT = 24
const OVERSCAN = 8

type PendingAction = 'start' | 'stop' | 'cancel' | 'status' | null

const toast = useToast()
const accumulator = createLineAccumulator()
const logEl = ref<HTMLElement | null>(null)
const lines = ref<string[]>([])
const query = ref('')
const levelFilter = ref<LogLevelFilter>('all')
const autoScroll = ref(true)
const scrollTop = ref(0)
const viewportH = ref(520)
const debugActive = ref<boolean | null>(null)
const socketConnected = ref(zwaveSocket.connected)
const pendingAction = ref<PendingAction>(null)

let resizeObserver: ResizeObserver | null = null

const levelOptions = computed(() => [
  { value: 'all', label: 'All levels' },
  ...LOG_LEVELS.map((level) => ({ value: level, label: levelLabel(level) })),
])

const filteredLines = computed(() => filterLines(lines.value, { query: query.value, level: levelFilter.value }))
const filteredParsed = computed<ParsedLogLine[]>(() => filteredLines.value.map(parseLogLine))
const windowRange = computed(() =>
  computeWindow(scrollTop.value, ROW_HEIGHT, viewportH.value, filteredParsed.value.length, OVERSCAN),
)
const visibleLines = computed(() => filteredParsed.value.slice(windowRange.value.start, windowRange.value.end))
const isFiltered = computed(() => query.value.trim() !== '' || levelFilter.value !== 'all')
const downloadLines = computed(() => (isFiltered.value ? filteredLines.value : lines.value))
const streamingLabel = computed(() => {
  if (!socketConnected.value) return 'Socket disconnected'
  if (!debugActive.value) return 'Debug disabled'
  return autoScroll.value ? 'Streaming' : 'Paused'
})
const streamingStatus = computed(() => {
  if (!socketConnected.value || !debugActive.value) return 'idle'
  return autoScroll.value ? 'ok' : 'warn'
})
const emptyTitle = computed(() => (lines.value.length === 0 ? 'No debug logs yet' : 'No matching lines'))
const emptyDescription = computed(() =>
  lines.value.length === 0
    ? 'Start debug capture or wait for live debug events to arrive.'
    : 'Try changing the search text or level filter.',
)

function levelLabel(level: LogLevel): string {
  return level[0].toUpperCase() + level.slice(1)
}

function normalizeActive(response: { active?: unknown; enabled?: unknown; debug?: unknown } | undefined): boolean {
  return Boolean(response?.active ?? response?.enabled ?? response?.debug ?? false)
}

function handleDebugChunk(payload: unknown) {
  if (typeof payload !== 'string') return
  const nextLines = accumulator.push(payload)
  if (nextLines.length === 0) return
  lines.value = appendLines(lines.value, nextLines, MAX_LINES)
  if (autoScroll.value) void scrollToBottom()
}

function handleConnect() {
  socketConnected.value = true
  zwaveSocket.subscribe([Channel.debug])
}

function handleDisconnect() {
  socketConnected.value = false
}

function updateViewport() {
  if (!logEl.value) return
  viewportH.value = logEl.value.clientHeight || viewportH.value
}

function onScroll(event: Event) {
  const target = event.currentTarget as HTMLElement
  scrollTop.value = target.scrollTop
  viewportH.value = target.clientHeight || viewportH.value
  const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight
  if (distanceFromBottom > ROW_HEIGHT * 4) autoScroll.value = false
}

async function scrollToBottom() {
  await nextTick()
  if (!logEl.value) return
  updateViewport()
  logEl.value.scrollTop = logEl.value.scrollHeight
  scrollTop.value = logEl.value.scrollTop
}

async function refreshStatus() {
  pendingAction.value = 'status'
  try {
    const response = await fetchDebugStatus()
    debugActive.value = normalizeActive(response)
    if (response.success === false) toast.warning(response.message || 'Could not read debug status')
  } catch {
    debugActive.value = null
    toast.error('Could not read debug status')
  } finally {
    pendingAction.value = null
  }
}

function assertSuccess(response: { success?: boolean; message?: string }, fallback: string) {
  if (response.success === false) throw new Error(response.message || fallback)
}

async function runControl(action: Exclude<PendingAction, 'status' | null>) {
  pendingAction.value = action
  try {
    if (action === 'start') {
      const response = await startDebug(false)
      assertSuccess(response, 'Could not start debug capture')
      debugActive.value = true
      toast.success(response.message || 'Debug capture started')
    } else if (action === 'stop') {
      const response = await stopDebug()
      assertSuccess(response, 'Could not stop debug capture')
      debugActive.value = false
      toast.success(response.message || 'Debug capture stopped')
    } else {
      const response = await cancelDebug()
      assertSuccess(response, 'Could not cancel debug capture')
      debugActive.value = false
      toast.success(response.message || 'Debug capture cancelled')
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Debug control request failed')
  } finally {
    pendingAction.value = null
  }
}

function clearBuffer() {
  lines.value = []
  scrollTop.value = 0
  if (logEl.value) logEl.value.scrollTop = 0
}

function downloadBuffer() {
  const blob = linesToBlob(downloadLines.value)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  anchor.href = url
  anchor.download = `zwave-debug-${isFiltered.value ? 'filtered-' : ''}${timestamp}.log`
  anchor.click()
  URL.revokeObjectURL(url)
}

async function copyLine(line: ParsedLogLine) {
  try {
    await navigator.clipboard.writeText(line.text)
    toast.success('Copied log line')
  } catch {
    toast.error('Could not copy log line')
  }
}

watch(autoScroll, (enabled) => {
  if (enabled) void scrollToBottom()
})

watch([filteredLines, query, levelFilter], () => {
  if (autoScroll.value) void scrollToBottom()
})

onMounted(() => {
  zwaveSocket.subscribe([Channel.debug])
  zwaveSocket.on(SocketEvent.debug, handleDebugChunk)
  zwaveSocket.on('connect', handleConnect)
  zwaveSocket.on('disconnect', handleDisconnect)
  if (typeof ResizeObserver !== 'undefined' && logEl.value) {
    resizeObserver = new ResizeObserver(updateViewport)
    resizeObserver.observe(logEl.value)
  }
  updateViewport()
  void refreshStatus()
})

onBeforeUnmount(() => {
  const remaining = accumulator.flush()
  if (remaining.length > 0) lines.value = appendLines(lines.value, remaining, MAX_LINES)
  resizeObserver?.disconnect()
  zwaveSocket.off(SocketEvent.debug, handleDebugChunk)
  zwaveSocket.off('connect', handleConnect)
  zwaveSocket.off('disconnect', handleDisconnect)
  zwaveSocket.unsubscribe([Channel.debug])
})
</script>

<template>
  <section class="debug-log">
    <BaseCard>
      <template #header>
        <div class="debug-log__header">
          <div>
            <div class="debug-log__eyebrow">
              <BaseBadge variant="expert" size="sm">Expert</BaseBadge>
              <span>Diagnostics</span>
            </div>
            <h1>Debug log viewer</h1>
            <p>Stream live backend and driver debug output with local filtering, pause, and export.</p>
          </div>
          <BaseBadge :variant="debugActive ? 'success' : 'neutral'">
            <StatusDot :status="debugActive ? 'ok' : 'idle'" :pulse="debugActive === true" />
            {{ debugActive === null ? 'Unknown' : debugActive ? 'Debug enabled' : 'Debug disabled' }}
          </BaseBadge>
        </div>
      </template>

      <div class="debug-log__controls">
        <BaseButton
          size="sm"
          :loading="pendingAction === 'start'"
          :disabled="debugActive === true || pendingAction !== null"
          @click="runControl('start')"
        >
          Start
        </BaseButton>
        <BaseButton
          size="sm"
          variant="secondary"
          :loading="pendingAction === 'stop'"
          :disabled="debugActive !== true || pendingAction !== null"
          @click="runControl('stop')"
        >
          Stop
        </BaseButton>
        <BaseButton
          size="sm"
          variant="danger"
          :loading="pendingAction === 'cancel'"
          :disabled="debugActive !== true || pendingAction !== null"
          @click="runControl('cancel')"
        >
          Cancel
        </BaseButton>
        <BaseButton size="sm" variant="ghost" :loading="pendingAction === 'status'" @click="refreshStatus">Refresh</BaseButton>
        <BaseButton size="sm" variant="ghost" :disabled="lines.length === 0" @click="clearBuffer">Clear</BaseButton>
        <BaseButton size="sm" variant="secondary" :disabled="downloadLines.length === 0" @click="downloadBuffer">
          Download {{ isFiltered ? 'view' : 'buffer' }}
        </BaseButton>
      </div>

      <div class="debug-log__filters">
        <BaseTextField v-model="query" type="search" label="Search logs" placeholder="Filter by text…" />
        <BaseSelect v-model="levelFilter" label="Level" :options="levelOptions" />
        <BaseSwitch v-model="autoScroll" label="Auto-scroll" />
      </div>
    </BaseCard>

    <BaseCard flush>
      <template #header>
        <div class="debug-log__stats">
          <span>
            <StatusDot :status="streamingStatus" :pulse="streamingStatus === 'ok'" />
            {{ streamingLabel }}
          </span>
          <span>{{ filteredLines.length.toLocaleString() }} shown / {{ lines.length.toLocaleString() }} buffered</span>
          <BaseBadge v-if="isFiltered" variant="primary" size="sm">Filtered</BaseBadge>
        </div>
      </template>

      <div ref="logEl" class="debug-log__viewport" role="log" aria-label="Debug log output" @scroll="onScroll">
        <EmptyState v-if="filteredParsed.length === 0" icon="📜" :title="emptyTitle" :description="emptyDescription" />
        <div v-else class="debug-log__spacer" :style="{ paddingTop: `${windowRange.padTop}px`, paddingBottom: `${windowRange.padBottom}px` }">
          <div
            v-for="(line, index) in visibleLines"
            :key="`${windowRange.start + index}-${line.raw}`"
            class="debug-log__line"
            :class="line.level ? `debug-log__line--${line.level}` : undefined"
            :style="{ height: `${ROW_HEIGHT}px` }"
          >
            <span class="debug-log__line-number">{{ (windowRange.start + index + 1).toLocaleString() }}</span>
            <span class="debug-log__line-text">{{ line.text }}</span>
            <button class="debug-log__copy" type="button" aria-label="Copy log line" @click="copyLine(line)">Copy</button>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="debug-log__footer">
          <span>Buffer capped at {{ MAX_LINES.toLocaleString() }} lines; oldest entries are dropped.</span>
          <BaseButton v-if="!autoScroll && filteredParsed.length > 0" size="sm" variant="primary" @click="autoScroll = true">
            Jump to latest
          </BaseButton>
        </div>
      </template>
    </BaseCard>
  </section>
</template>

<style scoped>
.debug-log {
  display: grid;
  gap: var(--s-4);
}
.debug-log__header,
.debug-log__stats,
.debug-log__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  flex-wrap: wrap;
}
.debug-log__header h1,
.debug-log__header p {
  margin: 0;
}
.debug-log__header h1 {
  margin-top: var(--s-2);
  font-size: clamp(1.4rem, 2vw, 2rem);
}
.debug-log__header p,
.debug-log__footer,
.debug-log__stats {
  color: var(--color-text-muted);
}
.debug-log__eyebrow,
.debug-log__stats span {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
}
.debug-log__eyebrow {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.debug-log__controls,
.debug-log__filters {
  display: flex;
  gap: var(--s-3);
  flex-wrap: wrap;
  align-items: end;
}
.debug-log__controls {
  margin-bottom: var(--s-4);
}
.debug-log__filters > :first-child {
  flex: 1 1 280px;
}
.debug-log__filters > :nth-child(2) {
  flex: 0 1 180px;
}
.debug-log__viewport {
  height: clamp(360px, 58vh, 720px);
  overflow: auto;
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: 0.8125rem;
  line-height: 1.4;
}
.debug-log__spacer {
  min-width: max-content;
}
.debug-log__line {
  display: grid;
  grid-template-columns: 5.5rem minmax(24rem, 1fr) auto;
  align-items: center;
  gap: var(--s-3);
  padding: 0 var(--s-3);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  white-space: pre;
}
.debug-log__line-number {
  color: var(--color-text-muted);
  user-select: none;
  text-align: right;
}
.debug-log__line-text {
  overflow: hidden;
  text-overflow: ellipsis;
}
.debug-log__copy {
  opacity: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--r-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  padding: var(--s-1) var(--s-2);
  cursor: pointer;
}
.debug-log__line:hover .debug-log__copy,
.debug-log__copy:focus-visible {
  opacity: 1;
}
.debug-log__line--error {
  color: var(--danger);
}
.debug-log__line--warn {
  color: var(--warn);
}
.debug-log__line--info {
  color: var(--info);
}
.debug-log__line--debug {
  color: var(--color-primary-strong);
}
.debug-log__line--silly,
.debug-log__line--verbose {
  color: var(--color-text-muted);
}
.debug-log__footer {
  font-size: 0.875rem;
}
@media (max-width: 760px) {
  .debug-log__controls > *,
  .debug-log__filters > * {
    flex: 1 1 100%;
  }
  .debug-log__line {
    grid-template-columns: 4rem minmax(18rem, 1fr) auto;
  }
}
</style>

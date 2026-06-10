<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'

interface DetectedBarcode {
  rawValue: string
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
}

type ScannerWindow = Window & { BarcodeDetector?: BarcodeDetectorConstructor }

const emit = defineEmits<{
  scanned: [value: string]
  error: [message: string]
  close: []
}>()

const video = ref<HTMLVideoElement>()
const starting = ref(true)
const message = ref('Starting camera…')
let stream: MediaStream | undefined
let detector: BarcodeDetectorInstance | undefined
let frame = 0
let scanning = false

onMounted(() => {
  void start()
})

onBeforeUnmount(stop)

async function start() {
  try {
    const Detector = (window as ScannerWindow).BarcodeDetector
    if (!Detector) throw new Error('QR scanning is not supported in this browser. Paste the code instead.')
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not available. Paste the code instead.')

    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
    detector = new Detector({ formats: ['qr_code'] })
    if (video.value) {
      video.value.srcObject = stream
      await video.value.play()
    }
    starting.value = false
    message.value = 'Point the camera at the Smart Start QR code.'
    scanning = true
    scanLoop()
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Could not start the camera. Paste the code instead.'
    message.value = text
    starting.value = false
    emit('error', text)
  }
}

function scanLoop() {
  frame = window.requestAnimationFrame(async () => {
    if (!scanning || !detector || !video.value || video.value.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      scanLoop()
      return
    }

    try {
      const codes = await detector.detect(video.value)
      const value = codes.find((code) => code.rawValue)?.rawValue
      if (value) {
        emit('scanned', value)
        stop()
        return
      }
    } catch {
      message.value = 'Scanning failed. Keep the QR code steady or paste the code below.'
    }
    scanLoop()
  })
}

function stop() {
  scanning = false
  if (frame) window.cancelAnimationFrame(frame)
  for (const track of stream?.getTracks() ?? []) track.stop()
  stream = undefined
  detector = undefined
}

function close() {
  stop()
  emit('close')
}
</script>

<template>
  <section class="scanner">
    <div class="preview">
      <video ref="video" playsinline muted />
      <div v-if="starting" class="overlay">{{ message }}</div>
    </div>
    <div class="scanner__footer">
      <p>{{ message }}</p>
      <BaseButton variant="secondary" @click="close">Close camera</BaseButton>
    </div>
  </section>
</template>

<style scoped>
.scanner {
  display: grid;
  gap: var(--s-3);
}
.preview {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1;
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  background: var(--color-surface-2);
}
video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--s-4);
  color: var(--color-text-muted);
  text-align: center;
  background: var(--color-surface-2);
}
.scanner__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--s-3);
}
p {
  margin: 0;
  color: var(--color-text-muted);
}
@media (max-width: 640px) {
  .scanner__footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>

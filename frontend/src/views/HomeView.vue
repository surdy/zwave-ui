<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useZwaveConnection } from '@/composables/useZwaveConnection'
import { useControllerStore } from '@/stores/controller'
import { useNodesStore } from '@/stores/nodes'
import { useUiStore } from '@/stores/ui'

const { connect } = useZwaveConnection()
const controller = useControllerStore()
const nodes = useNodesStore()
const ui = useUiStore()

const { status, info } = storeToRefs(controller)
const { advanced } = storeToRefs(ui)
const needsLogin = ref(false)

onMounted(async () => {
  try {
    const state = await connect()
    needsLogin.value = state === null
  } catch {
    /* status reflects the error */
  }
})
</script>

<template>
  <main class="home">
    <div class="home__card">
      <h1 class="home__title">Z-Wave UI</h1>
      <p class="home__tagline">Simple by default, powerful when you need it.</p>

      <dl class="home__status">
        <div>
          <dt>Connection</dt>
          <dd :data-status="status">{{ status }}</dd>
        </div>
        <div>
          <dt>App version</dt>
          <dd>{{ info?.appVersion ?? '—' }}</dd>
        </div>
        <div>
          <dt>Nodes</dt>
          <dd>{{ nodes.count }}</dd>
        </div>
      </dl>

      <p v-if="needsLogin" class="home__hint">
        Authentication required — login screen arrives in #6.
      </p>

      <ul v-if="nodes.list.length" class="home__nodes">
        <li v-for="node in nodes.list" :key="node.id">
          <span class="home__node-id">#{{ node.id }}</span>
          {{ node.name || node.productLabel || 'Unknown device' }}
          <span class="home__node-status">{{ node.status ?? '' }}</span>
        </li>
      </ul>

      <button class="home__toggle" type="button" @click="ui.toggleAdvanced()">
        {{ advanced ? 'Advanced mode: on' : 'Advanced mode: off' }}
      </button>
    </div>
  </main>
</template>

<style scoped>
.home {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: var(--s-4);
}

.home__card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-1);
  padding: var(--s-6);
  max-width: 480px;
  text-align: center;
}

.home__title {
  color: var(--color-primary);
  font-size: 2rem;
}

.home__tagline {
  color: var(--color-text-muted);
  margin: 0 0 var(--s-4);
}

.home__status {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--s-3);
  margin: var(--s-4) 0;
}

.home__status dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.home__status dd {
  margin: var(--s-1) 0 0;
  font-weight: 600;
}

.home__status dd[data-status='connected'] {
  color: var(--color-success, #16a34a);
}

.home__status dd[data-status='error'],
.home__status dd[data-status='disconnected'] {
  color: var(--color-danger, #dc2626);
}

.home__nodes {
  list-style: none;
  padding: 0;
  margin: var(--s-4) 0;
  text-align: left;
  display: grid;
  gap: var(--s-2);
}

.home__nodes li {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-2) var(--s-3);
  background: var(--color-bg, #f8fafc);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
}

.home__node-id {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

.home__node-status {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.home__hint {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.home__toggle {
  margin-top: var(--s-4);
  padding: var(--s-2) var(--s-4);
  border: 1px solid var(--color-border);
  border-radius: var(--r-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
</style>

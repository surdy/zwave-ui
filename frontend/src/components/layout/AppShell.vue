<script setup lang="ts">
/**
 * Responsive application shell: top bar + desktop side rail / mobile bottom nav,
 * global theme & advanced toggles, connection indicator, and the routed content
 * outlet. Owns the realtime connection bootstrap for the authenticated app.
 */
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui'
import { useZwaveConnection } from '@/composables/useZwaveConnection'
import { primaryNav } from './nav'
import BaseIcon from '@/components/base/BaseIcon.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import ThemeToggle from './ThemeToggle.vue'
import ConnectionIndicator from './ConnectionIndicator.vue'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const { advanced } = storeToRefs(ui)
const { connect } = useZwaveConnection()

const pageTitle = computed(() => {
  const fromMeta = route.meta?.title
  if (typeof fromMeta === 'string') return fromMeta
  return primaryNav.find((n) => n.name === route.name)?.label ?? 'Z-Wave UI'
})

function setAdvanced(value: boolean) {
  ui.setAdvanced(value)
}

onMounted(async () => {
  try {
    const state = await connect()
    if (state === null) router.replace({ name: 'login' })
  } catch {
    /* connection status is surfaced by the indicator */
  }
})
</script>

<template>
  <div class="shell">
    <!-- Desktop side rail -->
    <aside class="rail" aria-label="Primary">
      <RouterLink to="/dashboard" class="rail__brand">
        <span class="rail__logo" aria-hidden="true">◈</span>
        <span class="rail__brand-text">Z-Wave UI</span>
      </RouterLink>
      <nav class="rail__nav">
        <RouterLink
          v-for="item in primaryNav"
          :key="item.name"
          :to="item.to"
          class="nav-link"
        >
          <BaseIcon :name="item.icon" :size="22" />
          <span class="nav-link__label">{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <!-- Top bar -->
    <header class="topbar">
      <h1 class="topbar__title">{{ pageTitle }}</h1>
      <div class="topbar__actions">
        <ConnectionIndicator class="topbar__conn" />
        <label class="topbar__adv">
          <BaseSwitch
            :model-value="advanced"
            label="Advanced"
            @update:model-value="setAdvanced"
          />
        </label>
        <ThemeToggle />
      </div>
    </header>

    <!-- Routed content -->
    <main class="content">
      <RouterView />
    </main>

    <!-- Mobile bottom navigation -->
    <nav class="bottomnav" aria-label="Primary">
      <RouterLink
        v-for="item in primaryNav"
        :key="item.name"
        :to="item.to"
        class="bottomnav__link"
      >
        <BaseIcon :name="item.icon" :size="22" />
        <span class="bottomnav__label">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  min-height: 100dvh;
}

/* ---------- Top bar ---------- */
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  height: var(--topbar-h);
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: 0 var(--s-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
.topbar__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topbar__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
/* Hide the connection text label on very small screens (dot stays). */
.topbar__conn :deep(.conn__label) {
  display: none;
}
.topbar__adv :deep(.switch__label) {
  display: none;
}

/* ---------- Content ---------- */
.content {
  padding: var(--s-4);
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + var(--s-4));
}

/* ---------- Side rail (desktop) ---------- */
.rail {
  display: none;
}
.rail__brand {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  height: var(--topbar-h);
  padding: 0 var(--s-4);
  color: var(--color-text);
  text-decoration: none;
  font-weight: 700;
  border-bottom: 1px solid var(--color-border);
}
.rail__logo {
  color: var(--color-primary);
  font-size: 1.25rem;
}
.rail__nav {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
  padding: var(--s-3);
}
.nav-link {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-3);
  border-radius: var(--r-md);
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 500;
  transition: background 0.12s ease, color 0.12s ease;
}
.nav-link:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}
.nav-link.router-link-active {
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
}
.nav-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* ---------- Bottom nav (mobile) ---------- */
.bottomnav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.bottomnav__link {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: var(--s-2) 0;
  min-height: 56px;
  color: var(--color-text-muted);
  text-decoration: none;
}
.bottomnav__label {
  font-size: 0.6875rem;
  font-weight: 500;
}
.bottomnav__link.router-link-active {
  color: var(--color-primary);
}
.bottomnav__link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

/* ---------- Desktop layout (≥1024px) ---------- */
@media (min-width: 1024px) {
  .shell {
    display: grid;
    grid-template-columns: var(--nav-w) 1fr;
    grid-template-rows: var(--topbar-h) 1fr;
    grid-template-areas:
      'rail topbar'
      'rail content';
  }
  .rail {
    grid-area: rail;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--color-border);
    background: var(--color-surface);
    position: sticky;
    top: 0;
    height: 100vh;
    height: 100dvh;
  }
  .topbar {
    grid-area: topbar;
  }
  .content {
    grid-area: content;
    padding: var(--s-5);
  }
  .bottomnav {
    display: none;
  }
  /* Room for richer labels on desktop. */
  .topbar__conn :deep(.conn__label) {
    display: inline;
  }
  .topbar__adv :deep(.switch__label) {
    display: inline;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-link {
    transition: none;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import BaseCard from '@/components/base/BaseCard.vue'

interface SettingsSection {
  name: string
  title: string
  description: string
  icon: string
}

const route = useRoute()

const sections: SettingsSection[] = [
  {
    name: 'settings-general',
    title: 'General & Appearance',
    description: 'Theme, language, units, and app defaults',
    icon: '🎨',
  },
  {
    name: 'settings-zwave',
    title: 'Z-Wave',
    description: 'Controller setup, RF region, security, and advanced tuning',
    icon: '📡',
  },
  {
    name: 'settings-integrations',
    title: 'Integrations',
    description: 'MQTT, Home Assistant, and Z-Wave JS server connections',
    icon: '🔗',
  },
  {
    name: 'settings-backup',
    title: 'Backup',
    description: 'NVM and store backups, schedules, and restore points',
    icon: '💾',
  },
  {
    name: 'settings-system',
    title: 'System',
    description: 'Logs, plugins, certificates, jobs, files, and About',
    icon: '🧰',
  },
]

const activeRouteName = computed(() => String(route.name ?? 'settings-general'))
const showMobileList = computed(() => route.query.sections === '1')
</script>

<template>
  <div class="settings" :class="{ 'settings--list': showMobileList }">
    <header class="settings__hero">
      <p class="settings__eyebrow">Settings</p>
      <h1>Configure Z-Wave UI</h1>
      <p>
        Start with General & Appearance, then jump into Z-Wave, integrations, backups, or
        system tools as those sections are implemented.
      </p>
    </header>

    <div class="settings__layout">
      <aside class="settings__nav" aria-label="Settings sections">
        <BaseCard flush>
          <nav class="section-list">
            <RouterLink
              v-for="section in sections"
              :key="section.name"
              :to="{ name: section.name }"
              class="section-link"
              :class="{ 'section-link--active': activeRouteName === section.name }"
            >
              <span class="section-link__icon" aria-hidden="true">{{ section.icon }}</span>
              <span class="section-link__body">
                <span class="section-link__title">{{ section.title }}</span>
                <span class="section-link__desc">{{ section.description }}</span>
              </span>
              <span class="section-link__chevron" aria-hidden="true">›</span>
            </RouterLink>
          </nav>
          <template #footer>
            <div class="settings__links">
              <RouterLink :to="{ name: 'settings-system' }">About Z-Wave UI</RouterLink>
              <a href="https://github.com/surdy/zwave-ui/tree/main/docs" target="_blank" rel="noreferrer">
                Documentation
              </a>
            </div>
          </template>
        </BaseCard>
      </aside>

      <section class="settings__detail" aria-label="Settings detail">
        <RouterLink class="settings__back" :to="{ query: { sections: '1' } }">← Settings sections</RouterLink>
        <RouterView />
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings {
  max-width: 1180px;
  margin: 0 auto;
}
.settings__hero {
  margin-bottom: var(--s-5);
}
.settings__eyebrow {
  margin: 0 0 var(--s-1);
  color: var(--color-primary-strong);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.settings__hero h1 {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
}
.settings__hero p:last-child {
  max-width: 68ch;
  margin: var(--s-2) 0 0;
  color: var(--color-text-muted);
}
.settings__layout {
  display: block;
}
.settings__nav {
  display: none;
}
.settings--list .settings__nav {
  display: block;
}
.settings--list .settings__detail {
  display: none;
}
.section-list {
  display: flex;
  flex-direction: column;
}
.section-link {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-4);
  color: var(--color-text);
  text-decoration: none;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.12s ease, color 0.12s ease;
}
.section-link:hover {
  background: var(--color-surface-2);
}
.section-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
.section-link--active {
  background: var(--color-primary-soft);
  color: var(--color-primary-strong);
}
.section-link__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--r-md);
  background: var(--color-surface-2);
  flex: none;
}
.section-link--active .section-link__icon {
  background: var(--color-surface);
}
.section-link__body {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--s-1);
}
.section-link__title {
  font-weight: 700;
}
.section-link__desc {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  line-height: 1.35;
}
.section-link__chevron {
  color: var(--color-text-muted);
  font-size: 1.5rem;
}
.settings__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
  font-size: 0.875rem;
}
.settings__links a {
  color: var(--color-primary-strong);
  font-weight: 600;
  text-decoration: none;
}
.settings__links a:hover {
  text-decoration: underline;
}
.settings__back {
  display: inline-flex;
  margin-bottom: var(--s-4);
  color: var(--color-primary-strong);
  font-weight: 700;
  text-decoration: none;
}

@media (min-width: 760px) {
  .settings__layout {
    display: grid;
    grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
    gap: var(--s-5);
    align-items: start;
  }
  .settings__nav,
  .settings--list .settings__nav,
  .settings--list .settings__detail {
    display: block;
  }
  .settings__nav {
    position: sticky;
    top: calc(var(--topbar-h) + var(--s-5));
  }
  .settings__back {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .section-link {
    transition: none;
  }
}
</style>

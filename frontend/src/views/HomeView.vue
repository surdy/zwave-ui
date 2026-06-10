<script setup lang="ts">
// Placeholder home view. Real screens (Dashboard, Devices, etc.) arrive in M2.
const backendVersion = import.meta.env.VITE_BACKEND ?? 'http://localhost:8091'
</script>

<template>
  <main class="home">
    <div class="home__card">
      <h1 class="home__title">Z-Wave UI</h1>
      <p class="home__tagline">Simple by default, powerful when you need it.</p>
      <p class="home__meta">
        Frontend scaffold is running. Backend proxy target:
        <code>{{ backendVersion }}</code>
      </p>
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

.home__meta {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
</style>

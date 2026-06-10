<script setup lang="ts">
/**
 * Login placeholder. The full authentication screen (username/password + token)
 * is implemented in #6; this exists so the auth router guard has a valid target.
 */
import EmptyState from '@/components/base/EmptyState.vue'
</script>

<template>
  <main class="login">
    <div class="login__card">
      <EmptyState
        icon="🔐"
        title="Sign in"
        description="Authentication is required for this instance. The login screen is implemented in #6."
      />
    </div>
  </main>
</template>

<style scoped>
.login {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--s-4);
}
.login__card {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-1);
}
</style>

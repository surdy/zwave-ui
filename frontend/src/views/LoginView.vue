<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authenticate, setSessionToken } from '@/api'
import { useZwaveConnection } from '@/composables/useZwaveConnection'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSwitch from '@/components/base/BaseSwitch.vue'
import BaseTextField from '@/components/base/BaseTextField.vue'

const route = useRoute()
const router = useRouter()
const { connect } = useZwaveConnection()

const formRef = ref<HTMLFormElement | null>(null)
const username = ref('')
const password = ref('')
const remember = ref(true)
const loading = ref(false)
const errorMessage = ref('')

function friendlyError(code?: number, message?: string): string {
  const normalized = message?.toLowerCase() ?? ''
  if (code === 429 || normalized.includes('rate') || normalized.includes('too many')) {
    return 'Too many attempts. Please wait and try again.'
  }
  if (code === 401 || normalized.includes('invalid') || normalized.includes('incorrect')) {
    return 'Incorrect username or password.'
  }
  return message || 'Incorrect username or password.'
}

async function submit() {
  if (loading.value) return
  errorMessage.value = ''
  loading.value = true

  try {
    const res = await authenticate(username.value.trim(), password.value)
    const token = res.user?.token
    if (!res.success || !token) {
      errorMessage.value = friendlyError(res.code, res.message)
      return
    }

    if (!remember.value) {
      // Keep the token in memory only: protected-route guards and the socket can
      // use it during this SPA session, but a browser reload starts logged out.
      setSessionToken(token)
    }

    await connect()
    const redirect = route.query.redirect
    await router.replace(typeof redirect === 'string' && redirect ? redirect : { name: 'dashboard' })
  } catch {
    errorMessage.value = "Can't reach the server. Check that Z-Wave JS UI is running."
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await nextTick()
  formRef.value?.querySelector<HTMLInputElement>('input')?.focus()
})
</script>

<template>
  <main class="login" aria-labelledby="login-title">
    <form ref="formRef" class="login__card" @submit.prevent="submit">
      <div class="login__header">
        <span class="login__logo" aria-hidden="true">◈</span>
        <div>
          <p class="login__eyebrow">Z-Wave UI</p>
          <h1 id="login-title" class="login__title">Sign in</h1>
        </div>
      </div>

      <p class="login__intro">Use your Z-Wave JS UI credentials to continue.</p>

      <BaseTextField
        v-model="username"
        label="Username"
        autocomplete="username"
        required
        :disabled="loading"
      />
      <BaseTextField
        v-model="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        required
        :disabled="loading"
      />

      <div class="login__row">
        <BaseSwitch v-model="remember" label="Remember me" :disabled="loading" />
      </div>

      <p v-if="errorMessage" class="login__error" role="alert">
        {{ errorMessage }}
      </p>

      <BaseButton type="submit" size="lg" block :loading="loading" :disabled="!username || !password">
        Sign in
      </BaseButton>
    </form>
  </main>
</template>

<style scoped>
.login {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--s-4);
  background:
    radial-gradient(circle at top, var(--color-primary-soft), transparent 34rem),
    var(--color-bg);
}
.login__card {
  width: min(100%, 430px);
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  padding: clamp(var(--s-5), 6vw, var(--s-6));
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-2);
}
.login__header {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.login__logo {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--r-md);
  color: var(--color-primary-strong);
  background: var(--color-primary-soft);
  font-size: 1.5rem;
}
.login__eyebrow {
  margin: 0 0 var(--s-1);
  color: var(--color-text-muted);
  font-size: 0.875rem;
  font-weight: 600;
}
.login__title {
  margin: 0;
  color: var(--color-text);
  font-size: clamp(1.75rem, 8vw, 2.25rem);
  line-height: 1.1;
}
.login__intro {
  margin: 0;
  color: var(--color-text-muted);
}
.login__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.login__error {
  margin: 0;
  padding: var(--s-3);
  border: 1px solid var(--danger);
  border-radius: var(--r-md);
  color: var(--danger);
  background: var(--danger-soft);
  font-size: 0.9375rem;
}
</style>

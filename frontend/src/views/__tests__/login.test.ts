import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LoginView from '../LoginView.vue'

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  setSessionToken: vi.fn((token: string | null) => {
    if (token) localStorage.removeItem('zwui.token')
  }),
  connect: vi.fn(),
  replace: vi.fn(),
  route: { query: {} as Record<string, string> },
}))

vi.mock('@/api', () => ({
  authenticate: mocks.authenticate,
  setSessionToken: mocks.setSessionToken,
}))

vi.mock('@/composables/useZwaveConnection', () => ({
  useZwaveConnection: () => ({ connect: mocks.connect }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))

function validJwt() {
  return `x.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.y`
}

function mountLogin() {
  return mount(LoginView)
}

async function fillAndSubmit(wrapper: ReturnType<typeof mountLogin>) {
  const inputs = wrapper.findAll('input')
  await inputs[0].setValue('admin')
  await inputs[1].setValue('secret')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('LoginView auth flow', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset()
    mocks.setSessionToken.mockClear()
    mocks.connect.mockReset()
    mocks.replace.mockReset()
    mocks.route.query = { redirect: '/devices?filter=awake' }
    mocks.connect.mockResolvedValue({ nodes: [] })
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('authenticates, reconnects, and navigates to the redirect target', async () => {
    const token = validJwt()
    mocks.authenticate.mockResolvedValue({ success: true, user: { token } })

    const wrapper = mountLogin()
    await fillAndSubmit(wrapper)

    expect(mocks.authenticate).toHaveBeenCalledWith('admin', 'secret')
    expect(mocks.connect).toHaveBeenCalledTimes(1)
    expect(mocks.replace).toHaveBeenCalledWith('/devices?filter=awake')
  })

  it('shows a friendly error for failed login and does not navigate', async () => {
    mocks.authenticate.mockResolvedValue({ success: false, code: 401, message: 'bad credentials' })

    const wrapper = mountLogin()
    await fillAndSubmit(wrapper)

    expect(wrapper.get('[role="alert"]').text()).toBe('Incorrect username or password.')
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('clears the persisted token and keeps a session token when remember me is off', async () => {
    const token = validJwt()
    mocks.authenticate.mockImplementation(async () => {
      localStorage.setItem('zwui.token', token)
      return { success: true, user: { token } }
    })

    const wrapper = mountLogin()
    await wrapper.get('[role="switch"]').trigger('click')
    await fillAndSubmit(wrapper)

    expect(mocks.setSessionToken).toHaveBeenCalledWith(token)
    expect(localStorage.getItem('zwui.token')).toBeNull()
    expect(mocks.connect).toHaveBeenCalledTimes(1)
    expect(mocks.replace).toHaveBeenCalledWith('/devices?filter=awake')
  })
})

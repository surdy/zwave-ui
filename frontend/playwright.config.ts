import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the integration smoke test (issue #30).
 *
 * The backend (mock-stick zwave-js-ui) is started separately by
 * `scripts/e2e.mjs`. Here we only build + serve the production frontend via
 * `vite preview` on :8092 (which proxies /socket.io + /api to the backend).
 */
const PORT = 8092
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})

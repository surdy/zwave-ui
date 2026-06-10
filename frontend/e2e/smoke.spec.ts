import { test, expect, type ConsoleMessage } from '@playwright/test'

/**
 * Cross-cutting smoke test (issue #30): boots against the local mock-stick
 * backend and proves the whole pipeline works end to end — the app loads,
 * the realtime socket connects, the shell/nav renders, the mock device shows
 * up (INITED → nodes), the theme toggle applies, and nothing throws.
 *
 * This is intentionally thin: per-feature behaviour is covered by unit tests.
 */

const PRIMARY_NAV = ['/dashboard', '/devices', '/add', '/network', '/settings']

/** Console/page errors that are environmental noise, not app bugs. */
function isIgnorableError(text: string): boolean {
  return (
    /favicon/i.test(text) ||
    /Failed to load resource/i.test(text) ||
    /\[vite\]/i.test(text)
  )
}

test('app boots, connects, lists the mock device, and toggles theme', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error' && !isIgnorableError(msg.text())) {
      errors.push(`console.error: ${msg.text()}`)
    }
  })

  await test.step('app loads with the shell + primary nav', async () => {
    await page.goto('/')
    // Lands on a shell route (dashboard by default), not the login screen.
    await expect(page).toHaveURL(/\/(dashboard|devices|network|settings|add)/)
    for (const href of PRIMARY_NAV) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible()
    }
  })

  await test.step('realtime socket connects to the backend', async () => {
    await expect(page.getByRole('status')).toHaveAttribute(
      'aria-label',
      /Backend Connected/,
    )
  })

  await test.step('mock device is listed (INITED → nodes pipeline)', async () => {
    await page.locator('a[href="/devices"]').first().click()
    await expect(page).toHaveURL(/\/devices$/)
    // The mock network exposes node 2 (a Window Covering); its card/row links
    // to /devices/<id>. At least one device must appear.
    await expect(page.locator('a[href^="/devices/"]').first()).toBeVisible({
      timeout: 45_000,
    })
  })

  await test.step('theme toggle applies light + dark to the document', async () => {
    const html = page.locator('html')
    const toggle = page.locator('[aria-label^="Theme:"]')
    await expect(toggle).toBeVisible()

    const cycleTo = async (label: 'Light' | 'Dark') => {
      for (let i = 0; i < 3; i++) {
        const current = await toggle.getAttribute('aria-label')
        if (current?.includes(`Theme: ${label}`)) return
        await toggle.click()
      }
      throw new Error(`theme toggle never reached "${label}"`)
    }

    await cycleTo('Light')
    await expect(html).toHaveAttribute('data-theme', 'light')
    await cycleTo('Dark')
    await expect(html).toHaveAttribute('data-theme', 'dark')
  })

  expect(errors, `unexpected console/page errors:\n${errors.join('\n')}`).toEqual(
    [],
  )
})

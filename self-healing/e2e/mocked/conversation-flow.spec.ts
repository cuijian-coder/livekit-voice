import { test, expect } from '@playwright/test'

test.describe('Conversation Flow', () => {
  test('session initializes on page load', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1500)

    const diagnostics = await page.evaluate(() => {
      return (window as any).__VOICE_DEBUG__?.getSnapshot?.()
    })

    expect(diagnostics).toBeDefined()
    expect(diagnostics?.conversation).toBeDefined()
  })

  test('mic button is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('push-to-talk')).toBeVisible({ timeout: 5000 })
  })

  test('backend health endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3000/health')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
  })
})

test.describe('Runtime State', () => {
  test('no stuck states after normal operation', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('[vite]')) {
        errors.push(msg.text())
      }
    })

    await page.waitForTimeout(2000)

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('WebSocket')
    )

    expect(criticalErrors.length).toBe(0)
  })
})
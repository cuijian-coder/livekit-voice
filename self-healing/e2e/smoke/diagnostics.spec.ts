import { test, expect } from '@playwright/test'

test.use({ permissions: ['microphone'] })

test.describe('Diagnostics Smoke', () => {
  test('diagnostics available via window.__VOICE_DEBUG__', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    const diagnostics = await page.evaluate(() => {
      return (window as any).__VOICE_DEBUG__?.getSnapshot?.() ?? null
    })

    expect(diagnostics).not.toBeNull()
  })

  test('diagnostics has all required sections', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    const diagnostics = await page.evaluate(() => {
      return (window as any).__VOICE_DEBUG__?.getSnapshot?.()
    })

    expect(diagnostics?.permissions).toBeDefined()
    expect(diagnostics?.websocket).toBeDefined()
    expect(diagnostics?.audio).toBeDefined()
    expect(diagnostics?.conversation).toBeDefined()
    expect(diagnostics?.environment).toBeDefined()
  })

  test('frontend loads without crash', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
    await page.waitForTimeout(1000)

    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('[vite]')) {
        errors.push(msg.text())
      }
    })

    await page.waitForTimeout(500)
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('WebSocket') &&
      !e.includes('ERR_CONNECTION_REFUSED')
    )
    expect(criticalErrors.length).toBe(0)
  })
})
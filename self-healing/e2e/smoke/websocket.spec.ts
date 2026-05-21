import { test, expect } from '@playwright/test'

test.use({ permissions: ['microphone'] })

test.describe('WebSocket Smoke', () => {
  test('websocket connects on page load', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    const wsStatus = page.getByTestId('ws-status')
    await expect(wsStatus).toBeVisible()
    const text = await wsStatus.textContent()
    expect(text).toMatch(/connected|connecting|reconnecting/i)
  })

  test('websocket stays connected during interaction', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    await page.getByTestId('push-to-talk').click()
    await page.waitForTimeout(500)

    const wsStatus = page.getByTestId('ws-status')
    const text = await wsStatus.textContent()
    expect(text).toMatch(/connected/i)
  })
})
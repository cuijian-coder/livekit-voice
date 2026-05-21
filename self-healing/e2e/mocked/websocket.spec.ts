import { test, expect } from '@playwright/test'
import {
  expectWsStatus,
  expectConversationState
} from '../helpers/assertions'

test.describe('WebSocket', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1500)
  })

  test('websocket connects on page load', async ({ page }) => {
    const wsStatus = page.getByTestId('ws-status')
    await expect(wsStatus).toBeVisible()

    const text = await wsStatus.textContent()
    expect(text).toMatch(/connected|disconnected/)
  })

  test('conversation state initializes to idle', async ({ page }) => {
    await expectConversationState(page, 'idle')
  })

  test('ws-status shows connected after session start', async ({ page }) => {
    await page.getByTestId('push-to-talk').click()
    await page.waitForTimeout(500)

    await expectWsStatus(page, 'connected')
  })

  test('runtime diagnostics includes websocket state', async ({ page }) => {
    const diagnostics = await page.evaluate(() => {
      return (window as any).__VOICE_DEBUG__?.getSnapshot?.() ?? null
    })

    expect(diagnostics).not.toBeNull()
    expect(diagnostics?.websocket).toBeDefined()
    expect(diagnostics?.websocket?.connected).toBeDefined()
    expect(diagnostics?.websocket?.reconnectCount).toBeDefined()
  })
})
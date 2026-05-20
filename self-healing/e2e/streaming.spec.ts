import { test, expect } from '@playwright/test'
import {
  expectConversationState,
  expectAudioState,
  clickPushToTalk,
  getRuntimeDiagnostics
} from './helpers/assertions'

test.describe('Streaming', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)
  })

  test('session initializes on page load', async ({ page }) => {
    const diagnostics = await getRuntimeDiagnostics(page)
    expect(diagnostics).not.toBeNull()
    expect(diagnostics?.conversation).toBeDefined()
  })

  test('push-to-talk initiates audio streaming', async ({ page }) => {
    await clickPushToTalk(page)
    await expectConversationState(page, 'listening')
    await expectAudioState(page, 'recording')
  })

  test('conversation state transitions from idle to listening', async ({ page }) => {
    await page.getByTestId('push-to-talk').click()

    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="conversation-state"]')
      return el?.textContent === 'listening'
    }, { timeout: 5000 })

    const diagnostics = await getRuntimeDiagnostics(page)
    expect(diagnostics?.conversation?.state).toBe('listening')
  })

  test('runtime diagnostics tracks audio recording', async ({ page }) => {
    await clickPushToTalk(page)
    await page.waitForTimeout(300)

    const diagnostics = await getRuntimeDiagnostics(page)
    expect(diagnostics?.audio?.recording).toBe(true)
  })
})
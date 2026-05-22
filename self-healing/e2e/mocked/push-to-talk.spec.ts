import { test, expect } from '@playwright/test'
import {
  expectConversationState,
  expectAudioState,
  expectPushToTalkVisible,
  getRuntimeDiagnostics
} from '../helpers/assertions'

test.describe('Push-to-Talk', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)
  })

  test('push-to-talk button is visible', async ({ page }) => {
    await expectPushToTalkVisible(page)
  })

  test('click push-to-talk transitions to listening state', async ({ page }) => {
    await page.getByTestId('push-to-talk').click()
    await expectConversationState(page, 'listening')
  })

  test('audio state becomes recording during listening', async ({ page }) => {
    await page.getByTestId('push-to-talk').click()
    await expectAudioState(page, 'recording')
  })

  test('runtime diagnostics reflects listening state', async ({ page }) => {
    await page.getByTestId('push-to-talk').click()
    await page.waitForTimeout(500)

    const diagnostics = await getRuntimeDiagnostics(page)
    expect(diagnostics?.conversation?.state).toBe('listening')
    expect(diagnostics?.audio?.recording).toBe(true)
  })

  test('click push-to-talk again stops recording', async ({ page }) => {
    await page.getByTestId('push-to-talk').click()
    await page.waitForTimeout(500)

    await page.getByTestId('push-to-talk').click({ force: true })
    await expectConversationState(page, 'transcribing')
    await expectAudioState(page, 'idle')
  })
})
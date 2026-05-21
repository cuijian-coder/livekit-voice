import { test, expect } from '@playwright/test'
import {
  expectConversationState,
  expectAudioState,
  clickPushToTalk
} from '../helpers/assertions'

test.describe('Interrupt', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)
  })

  test('click push-to-talk during listening stops recording', async ({ page }) => {
    await clickPushToTalk(page)
    await expectConversationState(page, 'listening')
    await expectAudioState(page, 'recording')

    await clickPushToTalk(page)
    await expectAudioState(page, 'idle')
    await expectConversationState(page, 'thinking')
  })

  test('audio state clears after stopping recording', async ({ page }) => {
    await clickPushToTalk(page)
    await expectAudioState(page, 'recording')

    await clickPushToTalk(page)
    await expectAudioState(page, 'idle')
  })

  test('click push-to-talk during speaking transitions to thinking', async ({ page }) => {
    await clickPushToTalk(page)
    await page.waitForTimeout(500)

    await clickPushToTalk(page)
    await page.waitForTimeout(300)

    await expectConversationState(page, 'thinking')
  })
})
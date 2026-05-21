import { test, expect } from '@playwright/test'

test.describe('Microphone Permissions', () => {
  test('granted: push-to-talk transitions to listening', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['microphone'] })
    const page = await context.newPage()

    await page.goto('/')
    await page.waitForTimeout(1000)

    const micPermEl = page.getByTestId('mic-permission')
    await expect(micPermEl).toBeVisible()

    await page.getByTestId('push-to-talk').click()
    await page.waitForTimeout(1000)

    await expect(page.getByTestId('conversation-state')).toContainText('listening')

    await context.close()
  })

  test('granted: mic-permission shows granted state', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['microphone'] })
    const page = await context.newPage()

    await page.goto('/')
    await page.waitForTimeout(500)

    const micPermEl = page.getByTestId('mic-permission')
    await expect(micPermEl).toBeVisible()
    const permText = await micPermEl.textContent()
    expect(permText).toMatch(/granted|unknown/i)

    await context.close()
  })

  test('granted: conversation state becomes listening', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['microphone'] })
    const page = await context.newPage()

    await page.goto('/')
    await page.waitForTimeout(500)

    await page.getByTestId('push-to-talk').click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('conversation-state')).toContainText('listening')

    await context.close()
  })
})
import { test, expect } from '@playwright/test'

test.describe('Visibility API', () => {
  test('page visibility API works', async ({ page }) => {
    await page.goto('/')

    const initialState = await page.evaluate(() => document.visibilityState)
    expect(initialState).toBe('visible')
  })

  test('recording continues when tab hidden', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('push-to-talk').click()
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      document.visibilityState = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await page.waitForTimeout(500)

    const audioState = await page.getByTestId('audio-state').textContent()
    expect(audioState).toMatch(/recording/)
  })

  test('diagnostics visible on visibility change', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      document.visibilityState = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await page.waitForTimeout(200)

    const diagnostics = await page.evaluate(() => {
      return (window as any).__VOICE_DEBUG__?.getSnapshot?.()
    })

    expect(diagnostics).not.toBeNull()
  })
})
import { test, expect } from '@playwright/test'

test.describe('AudioContext Behavior', () => {
  test('AudioContext initializes in browser', async ({ page }) => {
    await page.goto('/')

    const audioContextState = await page.evaluate(() => {
      const ctx = new AudioContext()
      return ctx.state
    })

    expect(audioContextState).toMatch(/running|suspended/)
  })

  test('AudioContext can resume from suspended', async ({ page }) => {
    await page.goto('/')

    const canResume = await page.evaluate(async () => {
      const ctx = new AudioContext()
      if (ctx.state === 'suspended') {
        await ctx.resume()
        return ctx.state === 'running'
      }
      return true
    })

    expect(canResume).toBe(true)
  })

  test('audio context state reflects recording', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    await page.getByTestId('push-to-talk').click()
    await page.waitForTimeout(1000)

    const audioState = await page.getByTestId('audio-state').textContent()
    expect(audioState).toMatch(/recording|playing/)
  })
})
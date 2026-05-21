import { test, expect } from '@playwright/test'

test.describe('MediaDevices Availability', () => {
  test('navigator.mediaDevices is available', async ({ page }) => {
    await page.goto('/')

    const hasMediaDevices = await page.evaluate(() => {
      return !!navigator.mediaDevices
    })

    expect(hasMediaDevices).toBe(true)
  })

  test('can enumerate audio input devices', async ({ page }) => {
    await page.goto('/')

    const hasAudioInput = await page.evaluate(async () => {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.some(d => d.kind === 'audioinput')
    })

    expect(hasAudioInput).toBe(true)
  })

  test('diagnostics reflect mediaDevicesSupported', async ({ page }) => {
    await page.goto('/')

    const diagnostics = await page.evaluate(() => {
      return (window as any).__VOICE_DEBUG__?.getSnapshot?.()
    })

    expect(diagnostics?.environment?.mediaDevicesSupported).toBeDefined()
  })
})
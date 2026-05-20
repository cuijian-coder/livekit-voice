import { test, expect } from '@playwright/test'

test.describe('Audio Runtime', () => {
  test('AudioContext can initialize', async ({ page }) => {
    await page.goto('/')

    const audioAvailable = await page.evaluate(() => {
      const ctx = new AudioContext()
      return ctx.state === 'running' || ctx.state === 'suspended'
    })

    expect(audioAvailable).toBe(true)
  })

  test('AudioWorklet module can be loaded', async ({ page }) => {
    test.skip()
  })
})

test.describe('System Connectivity', () => {
  test('frontend page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
  })

  test('backend health endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3000/health')
    expect(response.ok()).toBe(true)

    const body = await response.json()
    expect(body).toHaveProperty('status')
    expect(body.status).toBe('ok')
  })

  test('websocket can connect to backend', async ({ page }) => {
    const connected = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:3000/ws')
        ws.onopen = () => {
          ws.close()
          resolve(true)
        }
        ws.onerror = () => resolve(false)
        setTimeout(() => resolve(false), 3000)
      })
    })

    expect(connected).toBe(true)
  })
})
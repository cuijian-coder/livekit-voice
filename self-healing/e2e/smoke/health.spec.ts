import { test, expect } from '@playwright/test'

test.use({ permissions: ['microphone'] })

test.describe('Backend Health', () => {
  test('backend health endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3000/health')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
  })

  test('debug runtime endpoint accessible', async ({ request }) => {
    const response = await request.get('http://localhost:3000/debug/runtime')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('collectedAt')
  })
})
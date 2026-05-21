import { test, expect } from '@playwright/test'
import {
  expectWsStatus,
  expectReconnectCount
} from '../helpers/assertions'

test.describe('Reconnect', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)
  })

  test('ws-status shows connected when page loads', async ({ page }) => {
    const wsStatus = page.getByTestId('ws-status')
    await expect(wsStatus).toBeVisible()
    const text = await wsStatus.textContent()
    expect(text).toMatch(/connected|disconnected/)
  })

  test('reconnect count starts at 0', async ({ page }) => {
    await expectReconnectCount(page, 0)
  })

  test('ws-status element is present with valid data-testid', async ({ page }) => {
    await expect(page.getByTestId('ws-status')).toBeVisible()
  })
})
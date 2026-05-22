import { Page, Locator, expect } from '@playwright/test'

export async function expectConversationState(
  page: Page,
  state: string
): Promise<void> {
  const locator = page.getByTestId('conversation-state')
  await expect(locator).toHaveText(state, { timeout: 5000 })
}

export async function expectWsStatus(
  page: Page,
  status: string
): Promise<void> {
  const locator = page.getByTestId('ws-status')
  await expect(locator).toContainText(status, { timeout: 5000 })
}

export async function expectAudioState(
  page: Page,
  state: string
): Promise<void> {
  const locator = page.getByTestId('audio-state')
  await expect(locator).toHaveText(state, { timeout: 5000 })
}

export async function expectReconnectCount(
  page: Page,
  count: number | string
): Promise<void> {
  const locator = page.getByTestId('reconnect-count')
  const expectedText = typeof count === 'number' ? `reconnect: ${count}` : count
  await expect(locator).toHaveText(expectedText, { timeout: 5000 })
}

export async function expectPushToTalkVisible(
  page: Page
): Promise<void> {
  await expect(page.getByTestId('push-to-talk')).toBeVisible({ timeout: 5000 })
}

export async function expectTextInputVisible(
  page: Page
): Promise<void> {
  await expect(page.getByTestId('text-input')).toBeVisible({ timeout: 5000 })
}

export async function expectTranscriptVisible(
  page: Page
): Promise<void> {
  await expect(page.getByTestId('transcript')).toBeVisible({ timeout: 5000 })
}

export async function clickPushToTalk(
  page: Page
): Promise<void> {
  await page.getByTestId('push-to-talk').click({ force: true })
}

export async function waitForConversationState(
  page: Page,
  state: string,
  timeout = 10000
): Promise<void> {
  await page.waitForFunction(
    (expectedState) => {
      const el = document.querySelector('[data-testid="conversation-state"]')
      return el?.textContent === expectedState
    },
    state,
    { timeout }
  )
}

export async function waitForAudioState(
  page: Page,
  state: string,
  timeout = 10000
): Promise<void> {
  await page.waitForFunction(
    (expectedState) => {
      const el = document.querySelector('[data-testid="audio-state"]')
      return el?.textContent === expectedState
    },
    state,
    { timeout }
  )
}

export async function getRuntimeDiagnostics(
  page: Page
): Promise<any> {
  return page.evaluate(() => {
    return (window as any).__VOICE_DEBUG__?.getSnapshot?.() ?? null
  })
}

export async function expectRuntimeState(
  page: Page,
  expected: {
    wsStatus?: string
    conversationState?: string
    audioState?: string
  }
): Promise<void> {
  const diagnostics = await getRuntimeDiagnostics(page)

  if (expected.wsStatus) {
    expect(diagnostics?.websocket?.status).toBe(expected.wsStatus)
  }
  if (expected.conversationState) {
    expect(diagnostics?.conversation?.state).toBe(expected.conversationState)
  }
  if (expected.audioState) {
    expect(diagnostics?.audio?.recording).toBe(expected.audioState === 'recording')
    expect(diagnostics?.audio?.playing).toBe(expected.audioState === 'playing')
  }
}

// Read Aloud assertions
export async function expectReadAloudPlaying(
  page: Page,
  messageId: string
): Promise<void> {
  const btn = page.locator(`[data-message-id="${messageId}"] [data-testid="read-aloud-btn"]`)
  await expect(btn).toHaveAttribute('data-playing', 'true')
}

export async function expectReadAloudStopped(
  page: Page,
  messageId: string
): Promise<void> {
  const btn = page.locator(`[data-message-id="${messageId}"] [data-testid="read-aloud-btn"]`)
  await expect(btn).toHaveAttribute('data-playing', 'false')
}

export async function getReadAloudState(page: Page): Promise<any> {
  return page.evaluate(() => {
    return (window as any).__READALOUD_STORE__?.getState?.() ?? null
  })
}

export async function getReadAloudPlayerState(page: Page): Promise<any> {
  return page.evaluate(() => {
    const player = (window as any).__READALOUD_PLAYER__
    if (!player) return null
    return {
      isActive: player.isActive?.(),
      currentMessageId: player.getCurrentMessageId?.(),
      audioContextState: player.audioContext?.state,
      queueLength: player.audioQueue?.length ?? 0,
      isPlaying: player.isPlaying
    }
  })
}
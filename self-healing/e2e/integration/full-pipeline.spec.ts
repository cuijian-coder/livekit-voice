import { test, expect } from '@playwright/test'
import {
  loadWavAudio,
  injectAudioFrames,
  enableTestMode,
  assertTestApiAvailable,
} from './helpers/audio-injection'

/**
 * Full Pipeline Integration Test (Real Backend)
 *
 * Flow:
 *   1. Click record
 *   2. Inject nls-sample-16k.wav (speech: "北京的天气")
 *   3. Wait 5s
 *   4. Inject nls-sample-16k.wav again (same speech)
 *   5. Wait 5s
 *   6. Click stop
 *   7. Backend: ASR → LLM → TTS
 *   8. Frontend: verify UI state transitions + content
 *
 * Cost: ~¥0.05 per run (real ASR + LLM + TTS APIs)
 * Timeout: 120s (ASR ~10s + LLM ~10s + TTS ~30s + buffer)
 */
test.describe('Full Pipeline — Real Backend', () => {
  test('record → inject ×2 → stop → ASR → LLM → TTS', async ({ page }) => {
    // Real backend ASR + LLM + TTS can take 60-120s total
    test.setTimeout(240000)

    const consoleLogs: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      consoleLogs.push(`[${msg.type()}] ${text}`)
    })

    // ============================================================
    // Step 1: Page load + test mode
    // ============================================================
    await page.goto('/')
    await page.waitForTimeout(2000)

    await assertTestApiAvailable(page)
    await enableTestMode(page)

    // Load audio once (will be injected twice)
    const audioUrl = '/e2e/fixtures/audio/nls-sample-16k.wav'
    const audioData = await loadWavAudio(page, audioUrl)
    console.log(`Loaded audio: ${audioData.length} samples`)

    // ============================================================
    // Step 2: Click record button
    // ============================================================
    const recordBtn = page.getByTestId('push-to-talk')
    await recordBtn.click()
    console.log('Recording started')

    // Verify button shows recording state (red pulse)
    await expect(recordBtn).toHaveClass(/recording/, { timeout: 5000 })

    // Verify voice state is 'listening'
    const stateAfterStart = await page.evaluate(() =>
      (window as any).__VOICE_DEBUG__?.getSnapshot?.()?.conversation?.state
    )
    expect(stateAfterStart).toBe('listening')
    console.log('State: listening')

    // ============================================================
    // Step 3: Inject first audio clip
    // ============================================================
    const result1 = await injectAudioFrames(page, audioData, {
      volumeBoost: 5.0,
      silenceFrames: 30,
    })
    console.log(
      `Injection 1 complete: ${result1.framesInjected} frames, ${result1.durationMs}ms`
    )

    // Wait 5s between injections
    await page.waitForTimeout(5000)

    // ============================================================
    // Step 4: Inject second audio clip
    // ============================================================
    const result2 = await injectAudioFrames(page, audioData, {
      volumeBoost: 5.0,
      silenceFrames: 30,
    })
    console.log(
      `Injection 2 complete: ${result2.framesInjected} frames, ${result2.durationMs}ms`
    )

    // Wait 5s before stopping
    await page.waitForTimeout(5000)

    // Verify still in listening state (not auto-committed)
    const stateBeforeStop = await page.evaluate(() =>
      (window as any).__VOICE_DEBUG__?.getSnapshot?.()?.conversation?.state
    )
    expect(stateBeforeStop).toBe('listening')
    console.log('State before stop: listening (no auto-commit)')

    // ============================================================
    // Step 5: Click stop button (manual commit)
    // ============================================================
    // Use force: true because recording button has pulse animation
    await recordBtn.click({ force: true })
    console.log('Manual stop triggered')

    // Verify state transitions to transcribing
    await page.waitForFunction(
      () =>
        (window as any).__VOICE_DEBUG__?.getSnapshot?.()?.conversation
          ?.state === 'transcribing',
      { timeout: 5000 }
    )
    console.log('State: transcribing')

    // ============================================================
    // Step 6: Wait for ASR result
    // ============================================================
    // Textarea should show recognized text (e.g. "北京的天气")
    const textInput = page.locator('[data-testid="text-input"]')
    await expect(textInput).toHaveValue(/北京|天气/, {
      timeout: 30000,
    })
    const asrText = await textInput.inputValue()
    console.log(`ASR result: "${asrText}"`)
    expect(asrText.length).toBeGreaterThan(0)

    // ============================================================
    // Step 7: Wait for LLM response in MessageList
    // ============================================================
    // Assistant message should appear
    const assistantMsg = page.locator('.message--assistant').first()
    await expect(assistantMsg).toBeVisible({ timeout: 30000 })

    // Message content should contain weather-related text
    await expect(assistantMsg).toContainText(/天气|北京|温度|气候/, {
      timeout: 30000,
    })
    const llmText = await assistantMsg.textContent()
    console.log(`LLM response preview: "${llmText?.slice(0, 100)}..."`)
    expect(llmText?.length).toBeGreaterThan(10)

    // ============================================================
    // Step 8: Wait for TTS / speaking or idle (pipeline completion)
    // ============================================================
    // The LLM response can be long, so TTS + playback may take 60-120s.
    // We wait for either speaking (TTS started) or idle (already done).
    // This caps the wait at ~90s instead of requiring full playback.
    console.time('tts-wait')
    const stateAfterLLM = await page.waitForFunction(
      () => {
        const s = (window as any).__VOICE_DEBUG__?.getSnapshot?.()
          ?.conversation?.state
        return s === 'speaking' || s === 'idle' ? s : null
      },
      { timeout: 90000 }
    )
    console.timeEnd('tts-wait')
    console.log(`State after LLM: ${stateAfterLLM}`)

    // Button should not be recording anymore
    await expect(recordBtn).not.toHaveClass(/recording/, { timeout: 5000 })

    // ============================================================
    // Step 9: Best-effort wait for idle (but don't fail if timeout)
    // ============================================================
    if (stateAfterLLM === 'speaking') {
      try {
        await page.waitForFunction(
          () =>
            (window as any).__VOICE_DEBUG__?.getSnapshot?.()?.conversation
              ?.state === 'idle',
          { timeout: 60000 }
        )
        console.log('State: idle (playback complete)')
      } catch {
        console.log('Note: playback still in progress at test end')
      }
    }

    // ============================================================
    // Step 10: Verify pipeline stats
    // ============================================================
    const stats = await page.evaluate(() =>
      (window as any).__VOICE_DEBUG__?.getPipelineStats?.()
    )
    console.log('Pipeline stats:', stats)

    expect(stats.injectFrames).toBeGreaterThan(0)
    expect(stats.pcmFramesProcessed).toBeGreaterThan(0)
    expect(stats.vadFramesProcessed).toBeGreaterThan(0)
    expect(stats.transportFramesSent).toBeGreaterThan(0)

    // ============================================================
    // Summary
    // ============================================================
    console.log('\n✅ Full pipeline test passed!')
    console.log(`   ASR: "${asrText}"`)
    console.log(`   LLM: "${llmText?.slice(0, 50)}..."`)
    console.log(`   Audio frames: ${stats.injectFrames}`)
    console.log(`   Transport frames: ${stats.transportFramesSent}`)
  })
})

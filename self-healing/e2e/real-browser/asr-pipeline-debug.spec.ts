import { test, expect } from '@playwright/test'

test.describe('Real ASR Pipeline - Debug Backend', () => {
  test('trace VAD -> commit -> backend flow', async ({ page }) => {
    const consoleLogs: string[] = []
    page.on('console', msg => {
      consoleLogs.push(msg.text())
    })

    await page.goto('/')
    await page.waitForTimeout(2000)

    // Load WAV
    const audioData = await page.evaluate(async () => {
      return await (window as any).__VOICE_TEST__?.loadWavFloat32(
        '/e2e/fixtures/audio/nls-sample-16k.wav'
      )
    })
    expect(audioData?.length).toBeGreaterThan(40000)

    // Calculate total frames and set maxFramesUntilEnd
    const sampleRate = 16000
    const frameDurationMs = 20
    const samplesPerFrame = Math.floor((sampleRate * frameDurationMs) / 1000) // 320
    const speechFrames = Math.ceil(audioData.length / samplesPerFrame)
    const maxFramesUntilEnd = speechFrames + 20 // smaller buffer

    await page.evaluate((maxFrames: number) => {
      ;(window as any).__VOICE_TEST__?.setMaxFramesUntilEnd(maxFrames)
    }, maxFramesUntilEnd)

    console.log('Starting test with maxFramesUntilEnd:', maxFramesUntilEnd)

    // Click push-to-talk
    await page.getByTestId('push-to-talk').click()
    await page.waitForTimeout(500)

    // Get initial state
    const initialState = await page.evaluate(() => {
      return {
        conversation: (window as any).__VOICE_DEBUG__?.getSnapshot?.()?.conversation?.state,
        pipeline: (window as any).__VOICE_DEBUG__?.getPipelineStats?.(),
        speechDetector: (window as any).__VOICE_DEBUG__?.getSpeechDetectorState?.()
      }
    })
    console.log('Initial state:', initialState)

    // Start injection - just inject a few frames first to trigger SPEAKING
    await page.evaluate(async (audioData: Float32Array) => {
      const sampleRate = 16000
      const samplesPerFrame = 320
      const volumeBoost = 5.0

      // Boost volume
      const boosted = new Float32Array(audioData.length)
      for (let i = 0; i < audioData.length; i++) {
        boosted[i] = Math.max(-1, Math.min(1, audioData[i] * volumeBoost))
      }

      // Inject just first 10 frames
      let injected = 0
      for (let i = 0; i < 10; i++) {
        const start = i * samplesPerFrame
        const end = start + samplesPerFrame
        const frame = boosted.slice(start, Math.min(end, boosted.length))
        ;(window as any).__VOICE_TEST__?.injectPcmData(frame)
        injected++
      }
      console.log('Injected 10 frames, total injected:', injected)

      // Check pipeline stats
      const stats10 = (window as any).__VOICE_DEBUG__?.getPipelineStats?.()
      console.log('Pipeline after 10 frames:', stats10)
    }, Array.from(audioData) as unknown as Float32Array)

    await page.waitForTimeout(500)

    // Check state after first injection
    const after10Frames = await page.evaluate(() => {
      return {
        conversation: (window as any).__VOICE_DEBUG__?.getSnapshot?.()?.conversation?.state,
        pipeline: (window as any).__VOICE_DEBUG__?.getPipelineStats?.(),
        speechDetector: (window as any).__VOICE_DEBUG__?.getSpeechDetectorState?.()
      }
    })
    console.log('After 10 frames:', after10Frames)

    // Continue injection to trigger POSSIBLE_END (but limited amount)
    await page.evaluate(async (audioData: Float32Array) => {
      return new Promise<void>((resolve) => {
        const sampleRate = 16000
        const samplesPerFrame = 320
        const volumeBoost = 5.0

        const boosted = new Float32Array(audioData.length)
        for (let i = 0; i < audioData.length; i++) {
          boosted[i] = Math.max(-1, Math.min(1, audioData[i] * volumeBoost))
        }

        // Inject enough frames to reach maxFramesUntilEnd (176 frames total)
        // We already injected 10, so inject 166 more
        let offset = 10 * samplesPerFrame
        const framesToInject = 166
        let framesInjected = 0
        const intervalId = setInterval(() => {
          if (framesInjected >= framesToInject) {
            clearInterval(intervalId)
            resolve()
            return
          }
          const end = Math.min(offset + samplesPerFrame, boosted.length)
          const frame = boosted.slice(offset, end)
          ;(window as any).__VOICE_TEST__?.injectPcmData(frame)
          offset = end
          framesInjected++
        }, 20)
      })
    }, Array.from(audioData) as unknown as Float32Array)

    // Check logs for relevant events
    const relevantLogs = consoleLogs.filter(log => 
      log.includes('binaryTransport') || 
      log.includes('utteranceManager') || 
      log.includes('speechDetector') ||
      log.includes('transport.sent') ||
      log.includes('audio.commit') ||
      log.includes('vad') ||
      log.includes('pipeline')
    )

    console.log('Relevant logs:', relevantLogs.slice(0, 50))

    // Count audio.pcm logs to see if worklet is sending frames
    const pcmLogs = consoleLogs.filter(log => log.includes('"event":"audio.pcm"') || log.includes('pipeline.pcm'))
    console.log('PCM log count:', pcmLogs.length)

    // Wait and check final state
    await page.waitForTimeout(3000)

    const finalState = await page.evaluate(() => {
      return {
        conversation: (window as any).__VOICE_DEBUG__?.getSnapshot?.()?.conversation?.state,
        pipeline: (window as any).__VOICE_DEBUG__?.getPipelineStats?.(),
        speechDetector: (window as any).__VOICE_DEBUG__?.getSpeechDetectorState?.()
      }
    })
    console.log('Final state:', finalState)

    // Check for audio.commit in logs
    const commitLogs = consoleLogs.filter(log => log.includes('audio.commit') || log.includes('commit'))
    console.log('Commit-related logs:', commitLogs)
  })
})
import { test, expect } from '@playwright/test'

/**
 * Real ASR Pipeline Test via Frame Injection
 * 
 * This test uses the PCM pipeline's injection mode:
 * - setTestMode(true) - skips AudioWorklet startup
 * - Audio comes ONLY from manual injectPcmData() calls
 * - VAD detection triggers commit when maxFramesUntilEnd reached
 * - Backend ASR processes the injected audio frames
 * 
 * This approach is deterministic and doesn't depend on:
 * - Real microphone
 * - Fake audio device
 * - System audio sources
 */
test.describe('Real ASR Pipeline - Injection Mode', () => {
  test('fake audio via injection triggers transcript via real ASR', async ({ page }) => {
    const consoleLogs: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        consoleLogs.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForTimeout(2000)

    // Verify __VOICE_TEST__ is available
    const voiceTest = await page.evaluate(() => {
      const vt = (window as any).__VOICE_TEST__
      return {
        exists: !!vt,
        keys: vt ? Object.keys(vt) : []
      }
    })
    expect(voiceTest.exists).toBe(true)
    expect(voiceTest.keys).toContain('setTestMode')
    expect(voiceTest.keys).toContain('injectPcmData')
    expect(voiceTest.keys).toContain('loadWavFloat32')
    console.log('__VOICE_TEST__ available:', voiceTest.keys)

    // Set test mode BEFORE clicking push-to-talk
    // This skips AudioWorklet startup, so only injected frames are processed
    await page.evaluate(() => {
      ;(window as any).__VOICE_TEST__?.setTestMode(true)
    })
    console.log('Test mode enabled - AudioWorklet will be skipped')

    // Load WAV audio
    const audioData = await page.evaluate(async () => {
      return await (window as any).__VOICE_TEST__?.loadWavFloat32(
        '/e2e/fixtures/audio/nls-sample-16k.wav'
      )
    })
    expect(audioData?.length).toBeGreaterThan(40000)
    console.log('Loaded audio samples:', audioData.length)

    // Calculate frame parameters
    const sampleRate = 16000
    const frameDurationMs = 20
    const samplesPerFrame = Math.floor((sampleRate * frameDurationMs) / 1000) // 320
    const speechFrames = Math.ceil(audioData.length / samplesPerFrame)
    const silenceFrames = 30
    const bufferFrames = 10
    const maxFramesUntilEnd = speechFrames + silenceFrames + bufferFrames

    // Click push-to-talk - starts recording in test mode (no AudioWorklet)
    await page.getByTestId('push-to-talk').click()
    await page.waitForTimeout(500)

    // Set maxFramesUntilEnd AFTER start() so it doesn't get reset
    await page.evaluate((maxFrames: number) => {
      ;(window as any).__VOICE_TEST__?.setMaxFramesUntilEnd(maxFrames)
    }, maxFramesUntilEnd)
    console.log('maxFramesUntilEnd set to:', maxFramesUntilEnd)

    // Verify we're in listening state
    const stateBefore = await page.evaluate(() => {
      const snapshot = (window as any).__VOICE_DEBUG__?.getSnapshot?.()
      return {
        state: snapshot?.conversation?.state,
        recording: snapshot?.audio?.recording
      }
    })
    console.log('State before injection:', stateBefore)
    expect(stateBefore.state).toBe('listening')
    expect(stateBefore.recording).toBe(true)

    // Inject audio with realtime cadence
    const injectionResult = await page.evaluate(async (audioData: Float32Array) => {
      return new Promise<void>((resolve) => {
        const sampleRate = 16000
        const frameDurationMs = 20
        const samplesPerFrame = Math.floor((sampleRate * frameDurationMs) / 1000) // 320
        const volumeBoost = 5.0

        // Compute speechFrames inside callback
        const speechFrames = Math.ceil(audioData.length / samplesPerFrame)
        const maxSilenceFrames = 30

        // Boost volume to ensure VAD detection
        const boosted = new Float32Array(audioData.length)
        for (let i = 0; i < audioData.length; i++) {
          boosted[i] = Math.max(-1, Math.min(1, audioData[i] * volumeBoost))
        }

        let offset = 0
        let silenceFramesSent = 0
        let framesInjected = 0

        console.log('Starting injection: speech frames:', speechFrames, ', silence frames:', maxSilenceFrames)

        // Check if recorder is ready
        const voiceTest = (window as any).__VOICE_TEST__
        const recorder = voiceTest?.recorder
        console.log('Recorder isRecording:', recorder?.isRecording?.())
        console.log('Recorder test mode check')

        const intervalId = setInterval(() => {
          let frame: Float32Array

          if (offset < boosted.length) {
            // Speech frame with padding for incomplete last frame
            const end = Math.min(offset + samplesPerFrame, boosted.length)
            if (end - offset < samplesPerFrame) {
              frame = new Float32Array(samplesPerFrame)
              frame.set(boosted.slice(offset, end), 0)
            } else {
              frame = boosted.slice(offset, end)
            }
            offset += samplesPerFrame
          } else if (silenceFramesSent < maxSilenceFrames) {
            // Silence frame to trigger VAD timeout
            frame = new Float32Array(samplesPerFrame)
            silenceFramesSent++
          } else {
            clearInterval(intervalId)
            console.log('Injection complete, frames injected:', framesInjected)
            resolve()
            return
          }

          try {
            voiceTest?.injectPcmData(frame)
            framesInjected++
          } catch (e) {
            console.log('Injection error:', e.message)
          }
        }, frameDurationMs)
      })
    }, Array.from(audioData) as unknown as Float32Array)

    console.log('Injection completed')

    // Wait for commit and ASR processing
    await page.waitForTimeout(2000)

    // Check pipeline stats
    const stats = await page.evaluate(() =>
      (window as any).__VOICE_DEBUG__?.getPipelineStats?.()
    )
    console.log('Pipeline stats:', stats)

    expect(stats.injectFrames).toBeGreaterThan(0)
    expect(stats.pcmFramesProcessed).toBeGreaterThan(0)
    expect(stats.vadFramesProcessed).toBeGreaterThan(0)
    expect(stats.lastVadState).toBe('POSSIBLE_END')

    // Check conversation state
    const convState = await page.evaluate(() =>
      (window as any).__VOICE_DEBUG__?.getSnapshot?.()?.conversation?.state
    )
    console.log('Conversation state:', convState)

    // Wait for transcript
    await page.waitForFunction(() => {
      const textarea = document.querySelector('[data-testid="text-input"]') as HTMLTextAreaElement
      return textarea?.value?.includes('北京')
    }, { timeout: 30000 })

    console.log('Test passed - transcript received')
  })
})
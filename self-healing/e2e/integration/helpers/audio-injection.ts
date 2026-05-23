/**
 * Audio Injection Helper
 *
 * Exposes functions for injecting PCM audio frames into the frontend pipeline
 * via the test-mode API (window.__VOICE_TEST__).
 */

export interface InjectionResult {
  framesInjected: number
  durationMs: number
}

/**
 * Load a WAV file as Float32Array inside the browser page.
 */
export async function loadWavAudio(
  page: any,
  url: string
): Promise<Float32Array> {
  const audioData = await page.evaluate(async (audioUrl: string) => {
    return await (window as any).__VOICE_TEST__?.loadWavFloat32(audioUrl)
  }, url)
  if (!audioData || audioData.length === 0) {
    throw new Error(`Failed to load WAV audio from ${url}`)
  }
  return audioData
}

/**
 * Inject audio frames with realistic cadence (20ms per frame).
 *
 * @param page Playwright page
 * @param audioData Float32Array of audio samples (16kHz)
 * @param options Injection options
 */
export async function injectAudioFrames(
  page: any,
  audioData: Float32Array,
  options: {
    /** Volume multiplier (default 5.0) */
    volumeBoost?: number
    /** Frame duration in ms (default 20) */
    frameDurationMs?: number
    /** Sample rate (default 16000) */
    sampleRate?: number
    /** Number of silence frames after speech ends (default 30 = 600ms) */
    silenceFrames?: number
  } = {}
): Promise<InjectionResult> {
  const {
    volumeBoost = 5.0,
    frameDurationMs = 20,
    sampleRate = 16000,
    silenceFrames = 30,
  } = options

  const samplesPerFrame = Math.floor((sampleRate * frameDurationMs) / 1000)

  return await page.evaluate(
    async (args: any) => {
      const {
        audioData,
        volumeBoost,
        frameDurationMs,
        samplesPerFrame,
        silenceFrames,
      } = args

      return new Promise<InjectionResult>((resolve) => {
        // Boost volume
        const boosted = new Float32Array(audioData.length)
        for (let i = 0; i < audioData.length; i++) {
          boosted[i] = Math.max(-1, Math.min(1, audioData[i] * volumeBoost))
        }

        let offset = 0
        let silenceSent = 0
        let framesInjected = 0
        const voiceTest = (window as any).__VOICE_TEST__

        const intervalId = setInterval(() => {
          let frame: Float32Array

          if (offset < boosted.length) {
            const end = Math.min(offset + samplesPerFrame, boosted.length)
            if (end - offset < samplesPerFrame) {
              frame = new Float32Array(samplesPerFrame)
              frame.set(boosted.slice(offset, end), 0)
            } else {
              frame = boosted.slice(offset, end)
            }
            offset += samplesPerFrame
          } else if (silenceSent < silenceFrames) {
            frame = new Float32Array(samplesPerFrame)
            silenceSent++
          } else {
            clearInterval(intervalId)
            const durationMs =
              (framesInjected + silenceSent) * frameDurationMs
            resolve({ framesInjected, durationMs })
            return
          }

          try {
            voiceTest?.injectPcmData(frame)
            framesInjected++
          } catch (e) {
            console.log('Injection error:', (e as Error).message)
          }
        }, frameDurationMs)
      })
    },
    {
      audioData: Array.from(audioData),
      volumeBoost,
      frameDurationMs,
      samplesPerFrame,
      silenceFrames,
    }
  )
}

/**
 * Enable test mode (skips AudioWorklet, allows injection).
 */
export async function enableTestMode(page: any): Promise<void> {
  await page.evaluate(() => {
    ;(window as any).__VOICE_TEST__?.setTestMode(true)
  })
}

/**
 * Verify that the test API is available.
 */
export async function assertTestApiAvailable(page: any): Promise<void> {
  const voiceTest = await page.evaluate(() => {
    const vt = (window as any).__VOICE_TEST__
    return {
      exists: !!vt,
      keys: vt ? Object.keys(vt) : [],
    }
  })

  if (!voiceTest.exists) {
    throw new Error('__VOICE_TEST__ API not available')
  }

  const requiredKeys = ['setTestMode', 'injectPcmData', 'loadWavFloat32']
  for (const key of requiredKeys) {
    if (!voiceTest.keys.includes(key)) {
      throw new Error(`__VOICE_TEST__ missing required key: ${key}`)
    }
  }
}

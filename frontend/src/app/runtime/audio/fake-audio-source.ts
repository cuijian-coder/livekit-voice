import { getLogger } from '@livekit-voice/shared/logger'

const logger = getLogger()

export interface FakeAudioSource {
  audioData: Float32Array
  sampleRate: number
  durationMs: number
}

export async function loadWavFloat32(url: string): Promise<FakeAudioSource> {
  logger.info('fakeAudioSource.loading', { url })

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch WAV: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  if (uint8Array.length < 44) {
    throw new Error('WAV file too small, invalid header')
  }

  const view = new DataView(arrayBuffer)

  const riff = String.fromCharCode(uint8Array[0], uint8Array[1], uint8Array[2], uint8Array[3])
  if (riff !== 'RIFF') {
    throw new Error('Invalid WAV: not RIFF format')
  }

  const wave = String.fromCharCode(uint8Array[8], uint8Array[9], uint8Array[10], uint8Array[11])
  if (wave !== 'WAVE') {
    throw new Error('Invalid WAV: not WAVE format')
  }

  const channels = view.getUint16(22, true)
  const sampleRate = view.getUint32(24, true)
  const bitsPerSample = view.getUint16(34, true)

  if (channels !== 1) {
    logger.warn('fakeAudioSource.stereo_to_mono', { channels })
  }
  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV format: ${bitsPerSample}bit (expected 16bit)`)
  }

  let dataOffset = 44
  let dataSize = view.getUint32(40, true)
  if (uint8Array.length < dataOffset + dataSize) {
    const chunkId = String.fromCharCode(uint8Array[36], uint8Array[37], uint8Array[38], uint8Array[39])
    if (chunkId === 'LIST') {
      dataOffset = 48
      dataSize = view.getUint32(42, true)
    }
  }

  const numSamples = dataSize / 2
  const float32Data = new Float32Array(numSamples)

  let sampleIndex = 0
  for (let i = dataOffset; i < dataOffset + dataSize; i += 2) {
    const int16Value = view.getInt16(i, true)
    float32Data[sampleIndex++] = int16Value / 32768.0
  }

  const durationMs = (numSamples / sampleRate) * 1000

  logger.info('fakeAudioSource.loaded', {
    sampleRate,
    channels,
    bitsPerSample,
    durationMs: Math.round(durationMs),
    samples: numSamples
  })

  return {
    audioData: float32Data,
    sampleRate,
    durationMs
  }
}

export function startInjection(
  recorder: { injectPcmData: (data: Float32Array) => void },
  audioData: Float32Array,
  sampleRate: number,
  chunkSizeMs: number = 30
): () => void {
  const samplesPerChunk = Math.floor((sampleRate * chunkSizeMs) / 1000)
  let currentIndex = 0
  let stopped = false

  logger.info('fakeAudioSource.injection.start', {
    chunkSizeMs,
    samplesPerChunk,
    totalSamples: audioData.length
  })

  const intervalId = setInterval(() => {
    if (stopped) {
      clearInterval(intervalId)
      return
    }

    if (currentIndex >= audioData.length) {
      clearInterval(intervalId)
      logger.info('fakeAudioSource.injection.complete')
      return
    }

    const endIndex = Math.min(currentIndex + samplesPerChunk, audioData.length)
    const chunk = audioData.slice(currentIndex, endIndex)
    recorder.injectPcmData(chunk)
    currentIndex = endIndex
  }, chunkSizeMs)

  return () => {
    stopped = true
    clearInterval(intervalId)
    logger.info('fakeAudioSource.injection.stopped', { injectedSamples: currentIndex })
  }
}

export function createSineWaveFloat32(
  frequency: number,
  durationMs: number,
  sampleRate: number = 16000,
  amplitude: number = 0.5
): Float32Array {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000)
  const float32Data = new Float32Array(numSamples)
  const angularFrequency = 2 * Math.PI * frequency

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    float32Data[i] = amplitude * Math.sin(angularFrequency * t)
  }

  return float32Data
}
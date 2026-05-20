import { getLogger } from '@livekit-voice/shared/logger'
import { diagnosticsCollector } from '../debug-provider'

const logger = getLogger()

export class TtsPlaybackManager {
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null

  init(): void {
    if (this.audioContext) {
      this.audioContext.close()
    }
    this.audioContext = new AudioContext({ sampleRate: 16000 })
    logger.info('tts.playback.init')
  }

  onChunk(pcmData: Uint8Array): void {
    if (!this.audioContext) {
      logger.warn('tts.playback.not.init')
      return
    }

    try {
      if (this.currentSource) {
        try {
          this.currentSource.stop()
        } catch (e) {
          // ignore if already stopped
        }
        this.currentSource = null
      }

      const audioBuffer = this.decodePcm(pcmData)
      this.currentSource = this.audioContext.createBufferSource()
      this.currentSource.buffer = audioBuffer
      this.currentSource.connect(this.audioContext.destination)
      this.currentSource.start()
      diagnosticsCollector.add({
        source: 'audio.playback',
        type: 'chunk.played',
        metadata: { size: pcmData.length }
      })
      logger.debug('tts.playback.chunk', { size: pcmData.length, duration: audioBuffer.duration })
    } catch (err) {
      logger.error('tts.playback.chunk.error', { err })
    }
  }

  onComplete(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch (e) {
        // ignore
      }
      this.currentSource = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    diagnosticsCollector.add({
      source: 'audio.playback',
      type: 'playback.completed'
    })
    logger.info('tts.playback.complete')
  }

  private decodePcm(pcmData: Uint8Array): AudioBuffer {
    const sampleCount = Math.floor(pcmData.length / 2)
    const float32Data = new Float32Array(sampleCount)

    for (let i = 0; i < sampleCount; i++) {
      const low = pcmData[i * 2]
      const high = pcmData[i * 2 + 1]
      const int16 = (high << 8) | low
      float32Data[i] = int16 / 32768
    }

    const audioBuffer = this.audioContext!.createBuffer(1, sampleCount, 16000)
    audioBuffer.copyToChannel(float32Data, 0)
    return audioBuffer
  }
}

export const ttsPlayback = new TtsPlaybackManager()
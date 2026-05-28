import { getLogger } from '@livekit-voice/shared/logger'
import { diagnosticsCollector } from '../debug-provider'

const logger = getLogger()

export class TtsPlaybackManager {
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private audioQueue: AudioBuffer[] = []
  private isPlaying = false
  private totalDuration = 0
  private ttsSampleRate = 16000
  private hasReceivedWavHeader = false
  private streamComplete = false
  private onPlaybackCompleteCallback: (() => void) | null = null

  init(): void {
    if (this.audioContext) {
      this.audioContext.close()
    }
    this.audioContext = new AudioContext({ sampleRate: 16000 })
    this.audioQueue = []
    this.isPlaying = false
    this.totalDuration = 0
    this.ttsSampleRate = 16000
    this.hasReceivedWavHeader = false
    logger.info('tts.playback.init')
  }

  onChunk(pcmData: Uint8Array): void {
    if (!this.audioContext) {
      logger.warn('tts.playback.not.init')
      return
    }

    try {
      const audioBuffer = this.decodePcm(pcmData)
      this.audioQueue.push(audioBuffer)
      this.totalDuration += audioBuffer.duration

      if (!this.isPlaying) {
        this.playNext()
      }

      diagnosticsCollector.add({
        source: 'audio.playback',
        type: 'chunk.received',
        metadata: { size: pcmData.length, duration: audioBuffer.duration, queueLength: this.audioQueue.length }
      })
      logger.debug('tts.playback.chunk', { size: pcmData.length, duration: audioBuffer.duration, totalDuration: this.totalDuration })
    } catch (err) {
      logger.error('tts.playback.chunk.error', { err })
    }
  }

  onComplete(): void {
    this.streamComplete = true
    diagnosticsCollector.add({
      source: 'audio.playback',
      type: 'playback.completed',
      metadata: { totalDuration: this.totalDuration, queueLength: this.audioQueue.length }
    })
    logger.info('tts.playback.complete', { totalDuration: this.totalDuration, queueLength: this.audioQueue.length })
    // If queue already empty, playback is fully done — fire callback immediately.
    if (!this.isPlaying && this.audioQueue.length === 0) {
      this.firePlaybackComplete()
    }
  }

  setOnPlaybackComplete(callback: () => void): void {
    this.onPlaybackCompleteCallback = callback
  }

  private firePlaybackComplete(): void {
    if (this.onPlaybackCompleteCallback) {
      this.onPlaybackCompleteCallback()
    }
    this.streamComplete = false
  }

  stop(): void {
    this.audioQueue = []
    this.isPlaying = false
    this.streamComplete = false
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        // ignore
      }
      this.currentSource = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.totalDuration = 0
  }

  private playNext(): void {
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlaying = false
      // Stream ended and queue drained → playback fully complete.
      if (this.streamComplete) {
        this.firePlaybackComplete()
      }
      return
    }

    this.isPlaying = true
    const audioBuffer = this.audioQueue.shift()!
    this.currentSource = this.audioContext.createBufferSource()
    this.currentSource.buffer = audioBuffer
    this.currentSource.connect(this.audioContext.destination)

    this.currentSource.onended = () => {
      this.currentSource = null
      this.playNext()
    }

    this.currentSource.start()
    logger.debug('tts.playback.started', { remaining: this.audioQueue.length })
  }

  private decodePcm(pcmData: Uint8Array): AudioBuffer {
    let offset = 0
    let sampleRate = this.ttsSampleRate

    // NLS streaming TTS: only the FIRST chunk contains WAV header.
    // Subsequent chunks are raw PCM. Do NOT scan for header on every chunk.
    if (!this.hasReceivedWavHeader && pcmData.length >= 44) {
      const riff = String.fromCharCode(pcmData[0], pcmData[1], pcmData[2], pcmData[3])
      const wave = String.fromCharCode(pcmData[8], pcmData[9], pcmData[10], pcmData[11])
      if (riff === 'RIFF' && wave === 'WAVE') {
        this.hasReceivedWavHeader = true
        // Parse sample rate from fmt chunk (offset 24, 4 bytes little-endian)
        sampleRate = pcmData[24] | (pcmData[25] << 8) | (pcmData[26] << 16) | (pcmData[27] << 24)
        this.ttsSampleRate = sampleRate

        // Walk chunks to find "data"
        offset = 36
        while (offset + 8 <= pcmData.length) {
          const chunkId = String.fromCharCode(pcmData[offset], pcmData[offset + 1], pcmData[offset + 2], pcmData[offset + 3])
          const chunkSize = pcmData[offset + 4] | (pcmData[offset + 5] << 8) | (pcmData[offset + 6] << 16) | (pcmData[offset + 7] << 24)
          if (chunkId === 'data') {
            offset += 8
            break
          }
          offset += 8 + chunkSize
          if (offset > pcmData.length) {
            logger.warn('tts.playback.wav.corruptHeader', { length: pcmData.length })
            offset = 44
            break
          }
        }

        logger.debug('tts.playback.firstChunk', {
          length: pcmData.length,
          offset,
          sampleRate,
          pcmBytes: pcmData.length - offset,
        })
      }
    }

    const pcmLength = pcmData.length - offset
    // PCM must be even-length (16-bit samples). Drop trailing odd byte if any.
    const effectiveLength = pcmLength - (pcmLength % 2)
    const sampleCount = Math.floor(effectiveLength / 2)

    if (sampleCount === 0) {
      logger.warn('tts.playback.emptyChunk', { length: pcmData.length, offset })
      const emptyBuffer = this.audioContext!.createBuffer(1, 1, sampleRate)
      return emptyBuffer
    }

    // Use DataView for robust little-endian int16 parsing
    const view = new DataView(pcmData.buffer, pcmData.byteOffset + offset, effectiveLength)
    const float32Data = new Float32Array(sampleCount)
    for (let i = 0; i < sampleCount; i++) {
      float32Data[i] = view.getInt16(i * 2, true) / 32768
    }

    const audioBuffer = this.audioContext!.createBuffer(1, sampleCount, sampleRate)
    audioBuffer.copyToChannel(float32Data, 0)
    return audioBuffer
  }
}

export const ttsPlayback = new TtsPlaybackManager()

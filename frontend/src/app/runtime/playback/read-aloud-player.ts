import { getLogger } from '@livekit-voice/shared/logger'

const logger = getLogger()

export class ReadAloudPlayer {
  private audioContext: AudioContext | null = null
  private audioQueue: AudioBuffer[] = []
  private isPlaying = false
  private currentMessageId: string | null = null
  private onCompleteCallback: ((messageId: string) => void) | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private ttsSampleRate = 16000
  private hasReceivedWavHeader = false

  init(messageId: string): void {
    if (this.audioContext) {
      this.audioContext.close()
    }
    this.audioContext = new AudioContext({ sampleRate: 16000 })
    this.currentMessageId = messageId
    this.audioQueue = []
    this.isPlaying = false
    this.ttsSampleRate = 16000
    this.hasReceivedWavHeader = false
    logger.info('readAloud.player.init', { messageId })
  }

  appendChunk(pcmData: Uint8Array): void {
    if (!this.audioContext) {
      logger.warn('readAloud.player.not.init')
      return
    }

    try {
      const audioBuffer = this.decodePcm(pcmData)
      this.audioQueue.push(audioBuffer)
      logger.debug('readAloud.player.chunk.queued', { 
        size: pcmData.length, 
        duration: audioBuffer.duration,
        queueLength: this.audioQueue.length 
      })

      if (!this.isPlaying) {
        this.playQueue()
      }
    } catch (err) {
      logger.error('readAloud.player.chunk.error', { err })
    }
  }

  private playQueue(): void {
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlaying = false
      return
    }

    this.isPlaying = true
    const audioBuffer = this.audioQueue.shift()!
    
    this.currentSource = this.audioContext.createBufferSource()
    this.currentSource.buffer = audioBuffer
    this.currentSource.connect(this.audioContext.destination)
    
    this.currentSource.onended = () => {
      this.currentSource = null
      if (this.audioQueue.length > 0) {
        this.playQueue()
      } else {
        this.isPlaying = false
        logger.debug('readAloud.player.queue.empty')
      }
    }

    this.currentSource.start()
    logger.debug('readAloud.player.playing', { duration: audioBuffer.duration })
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch (e) {
        // ignore if already stopped
      }
      this.currentSource = null
    }
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.audioQueue = []
    this.isPlaying = false
    const stoppedMessageId = this.currentMessageId
    this.currentMessageId = null
    logger.info('readAloud.player.stopped', { messageId: stoppedMessageId })
  }

  onComplete(callback: (messageId: string) => void): void {
    this.onCompleteCallback = callback
  }

  notifyComplete(): void {
    if (this.currentMessageId && this.onCompleteCallback) {
      this.onCompleteCallback(this.currentMessageId)
    }
    this.stop()
  }

  isActive(): boolean {
    return this.currentMessageId !== null
  }

  getCurrentMessageId(): string | null {
    return this.currentMessageId
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
        sampleRate = pcmData[24] | (pcmData[25] << 8) | (pcmData[26] << 16) | (pcmData[27] << 24)
        this.ttsSampleRate = sampleRate

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
            offset = 44
            break
          }
        }

        logger.debug('readAloud.firstChunk', {
          length: pcmData.length,
          offset,
          sampleRate,
        })
      }
    }

    const pcmLength = pcmData.length - offset
    const effectiveLength = pcmLength - (pcmLength % 2)
    const sampleCount = Math.floor(effectiveLength / 2)

    if (sampleCount === 0) {
      logger.warn('readAloud.emptyChunk', { length: pcmData.length, offset })
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

export const readAloudPlayer = new ReadAloudPlayer()

// Expose to window for E2E testing (DEV only)
declare global {
  interface Window {
    __READALOUD_PLAYER__?: typeof readAloudPlayer
  }
}

if (import.meta.env.DEV) {
  window.__READALOUD_PLAYER__ = readAloudPlayer
}

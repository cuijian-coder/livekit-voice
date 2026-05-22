import { getLogger } from '@livekit-voice/shared/logger'

const logger = getLogger()

export class ReadAloudPlayer {
  private audioContext: AudioContext | null = null
  private audioQueue: AudioBuffer[] = []
  private isPlaying = false
  private currentMessageId: string | null = null
  private onCompleteCallback: ((messageId: string) => void) | null = null
  private currentSource: AudioBufferSourceNode | null = null

  init(messageId: string): void {
    if (this.audioContext) {
      this.audioContext.close()
    }
    this.audioContext = new AudioContext({ sampleRate: 16000 })
    this.currentMessageId = messageId
    this.audioQueue = []
    this.isPlaying = false
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

export const readAloudPlayer = new ReadAloudPlayer()

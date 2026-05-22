import { getLogger } from '@livekit-voice/shared/logger'
import { AUDIO_CONFIG } from '../constants'

const logger = getLogger()

export type SpeechState = 'IDLE' | 'SPEAKING' | 'POSSIBLE_END' | 'INTERRUPTING'

export interface SpeechDetectorConfig {
  energyThreshold: number
  silenceTimeoutMs: number
  minSpeechDurationMs: number
  maxFramesUntilEnd?: number
}

export type SpeechStateChangeHandler = (state: SpeechState) => void

export class SpeechDetector {
  private state: SpeechState = 'IDLE'
  private config: SpeechDetectorConfig
  private lastSpeechTime = 0
  private silenceStartTime: number | null = null
  private speechStartTime = 0
  private stateChangeHandler: SpeechStateChangeHandler | null = null
  private isAssistantSpeaking = false
  private frameCount = 0

  constructor(config: Partial<SpeechDetectorConfig> = {}) {
    this.config = {
      energyThreshold: config.energyThreshold ?? AUDIO_CONFIG.micEnergyThreshold,
      silenceTimeoutMs: config.silenceTimeoutMs ?? AUDIO_CONFIG.silenceTimeoutMs,
      minSpeechDurationMs: config.minSpeechDurationMs ?? AUDIO_CONFIG.minSpeechDurationMs,
      maxFramesUntilEnd: config.maxFramesUntilEnd,
    }
    logger.info('speechDetector.init', this.config)
  }

  onFrame(float32Data: Float32Array): SpeechState {
    this.frameCount++
    const energy = this.computeRMS(float32Data)
    const now = Date.now()
    const prevState = this.state

    switch (this.state) {
      case 'IDLE':
        if (energy > this.config.energyThreshold) {
          this.state = 'SPEAKING'
          this.speechStartTime = now
          this.lastSpeechTime = now
          this.silenceStartTime = null
          this.emitStateChange(prevState)
          return 'SPEAKING'
        }
        return 'IDLE'

      case 'SPEAKING':
        const forceEnd = this.config.maxFramesUntilEnd && 
                         this.frameCount >= this.config.maxFramesUntilEnd
        if (forceEnd) {
          this.state = 'POSSIBLE_END'
          this.emitStateChange(prevState)
          return 'POSSIBLE_END'
        }
        if (energy > this.config.energyThreshold) {
          if (this.isAssistantSpeaking) {
            const prevState = this.state
            this.state = 'INTERRUPTING'
            this.emitStateChange(prevState)
            return 'INTERRUPTING'
          }
          this.lastSpeechTime = now
          this.silenceStartTime = null
          return 'SPEAKING'
        } else {
          this.silenceStartTime = now
          const silenceDuration = now - this.lastSpeechTime
          const forceEnd = this.config.maxFramesUntilEnd && 
                           this.frameCount >= this.config.maxFramesUntilEnd
          if (silenceDuration >= this.config.silenceTimeoutMs || forceEnd) {
            const speechDuration = this.lastSpeechTime - this.speechStartTime
            if (speechDuration >= this.config.minSpeechDurationMs || forceEnd) {
              this.state = 'POSSIBLE_END'
              this.emitStateChange(prevState)
              return 'POSSIBLE_END'
            } else {
              this.state = 'IDLE'
              this.emitStateChange(prevState)
              return 'IDLE'
            }
          }
          return 'SPEAKING'
        }

      case 'POSSIBLE_END':
        if (energy > this.config.energyThreshold) {
          this.state = 'SPEAKING'
          this.lastSpeechTime = now
          this.silenceStartTime = null
          this.emitStateChange(prevState)
          return 'SPEAKING'
        }
        return 'POSSIBLE_END'

      case 'INTERRUPTING':
        return 'INTERRUPTING'
    }
  }

  setInterrupting(): void {
    if (this.state !== 'INTERRUPTING') {
      const prevState = this.state
      this.state = 'INTERRUPTING'
      this.emitStateChange(prevState)
    }
  }

  setAssistantSpeaking(speaking: boolean): void {
    this.isAssistantSpeaking = speaking
    logger.debug('speechDetector.assistantSpeaking', { speaking })
  }

  setStateChangeHandler(handler: SpeechStateChangeHandler): void {
    this.stateChangeHandler = handler
  }

  setMaxFramesUntilEnd(count: number | undefined): void {
    this.config.maxFramesUntilEnd = count
    logger.debug('speechDetector.setMaxFramesUntilEnd', { count })
  }

  reset(): void {
    const prevState = this.state
    this.state = 'IDLE'
    this.lastSpeechTime = 0
    this.silenceStartTime = null
    this.speechStartTime = 0
    this.frameCount = 0
    if (prevState !== 'IDLE') {
      this.emitStateChange(prevState)
    }
    logger.debug('speechDetector.reset')
  }

  getState(): SpeechState {
    return this.state
  }

  private computeRMS(float32Data: Float32Array): number {
    let sum = 0
    for (let i = 0; i < float32Data.length; i++) {
      sum += float32Data[i] * float32Data[i]
    }
    return Math.sqrt(sum / float32Data.length)
  }

  private emitStateChange(prevState: SpeechState): void {
    logger.info('speechDetector.stateChange', { from: prevState, to: this.state })
    if (this.stateChangeHandler) {
      this.stateChangeHandler(this.state)
    }
  }
}

export const speechDetector = new SpeechDetector()
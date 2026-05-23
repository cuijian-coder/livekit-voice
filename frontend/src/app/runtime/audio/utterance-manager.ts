import { getLogger } from '@livekit-voice/shared/logger'
import { invariant } from '../../../../../self-healing/assert'
import { speechDetector, type SpeechState } from './speech-detector'
import { binaryTransport } from '../transport'
import { wsClient } from '../transport/websocket-client'
import { audioRecorder } from './recorder'
import { pcmPipeline } from './pcm-pipeline'
import { createNewTurnId } from '../../voice/machine/voice-context'

const logger = getLogger()

export type UtteranceEventType = 'turn.start' | 'turn.commit' | 'turn.cancel'

export interface UtteranceEvent {
  type: UtteranceEventType
  turnId: string
}

export type UtteranceEventHandler = (event: UtteranceEvent) => void

export class UtteranceManager {
  private turnId = ''
  private isActive = false
  private eventHandler: UtteranceEventHandler | null = null
  private onInterruptedCallback: (() => void) | null = null

  constructor() {
    speechDetector.setStateChangeHandler(this.onSpeechStateChange.bind(this))
    logger.info('utteranceManager.init')
  }

  startTurn(): void {
    if (this.isActive) {
      logger.warn('utteranceManager.startTurn.ignored.alreadyActive', { turnId: this.turnId })
      return
    }

    this.turnId = createNewTurnId()
    this.isActive = true

    // Reset seq counters so each turn starts from 0
    audioRecorder.resetWorkletSeq()
    pcmPipeline.reset()

    binaryTransport.startTurn(this.turnId)
    wsClient.send({ type: 'audio.start', turnId: this.turnId } as any)
    logger.info('utteranceManager.turn.start', { turnId: this.turnId })

    this.emitEvent('turn.start', this.turnId)
  }

  async commit(): Promise<void> {
    invariant(this.turnId !== '', 'turnId required before commit')
    if (!this.isActive) {
      logger.warn('utteranceManager.commit.ignored.notActive')
      return
    }

    const finalSeq = (binaryTransport as any).lastSeq ?? -1
    logger.info('utteranceManager.commit.start', { turnId: this.turnId, finalSeq })

    await binaryTransport.flush()
    await binaryTransport.commit()
    
    logger.info('utteranceManager.commit.done', { turnId: this.turnId })
    this.emitEvent('turn.commit', this.turnId)
    
    this.isActive = false
    this.turnId = ''
  }

  cancel(): void {
    if (!this.isActive) {
      return
    }

    logger.info('utteranceManager.cancel', { turnId: this.turnId })
    binaryTransport.cancel()
    wsClient.send({ type: 'turn.cancel', turnId: this.turnId } as any)

    this.emitEvent('turn.cancel', this.turnId)

    if (this.onInterruptedCallback) {
      this.onInterruptedCallback()
    }

    this.isActive = false
    this.turnId = ''
  }

  resetTurnState(): void {
    this.isActive = false
    this.turnId = ''
  }

  reset(): void {
    this.cancel()
    speechDetector.reset()
  }

  setEventHandler(handler: UtteranceEventHandler): void {
    this.eventHandler = handler
  }

  setOnInterruptedCallback(callback: () => void): void {
    this.onInterruptedCallback = callback
  }

  isTurnActive(): boolean {
    return this.isActive
  }

  getCurrentTurnId(): string {
    return this.turnId
  }

  private onSpeechStateChange(state: SpeechState): void {
    switch (state) {
      case 'SPEAKING':
        if (!this.isActive) {
          this.startTurn()
        }
        break

      case 'POSSIBLE_END':
        // VAD auto-end does NOT commit the turn.
        // User must manually click the stop button to commit.
        // Keep isActive so the turn resumes if user starts speaking again.
        if (this.isActive) {
          logger.info('utteranceManager.possibleEnd', { turnId: this.turnId })
        }
        break

      case 'IDLE':
        this.isActive = false
        break

      case 'INTERRUPTING':
        this.cancel()
        break
    }
  }

  private emitEvent(type: UtteranceEventType, turnId: string): void {
    if (this.eventHandler) {
      this.eventHandler({ type, turnId })
    }
  }
}

export const utteranceManager = new UtteranceManager()
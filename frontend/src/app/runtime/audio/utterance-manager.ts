import { getLogger } from '@livekit-voice/shared/logger'
import { speechDetector, type SpeechState } from './speech-detector'
import { binaryTransport } from '../transport'
import { wsClient } from '../transport/websocket-client'
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

    binaryTransport.startTurn(this.turnId)
    wsClient.send({ type: 'audio.start', turnId: this.turnId } as any)
    logger.info('utteranceManager.turn.start', { turnId: this.turnId })

    this.emitEvent('turn.start', this.turnId)
  }

  async commit(): Promise<void> {
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
        this.commit()
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
import type { VoiceState } from '../../types/voice'
import { getMockResponse } from './mock-llm'
import { getLogger } from '@livekit-voice/shared/logger'

const logger = getLogger()

export class MockSession {
  private state: VoiceState = 'ready'

  getState(): VoiceState {
    return this.state
  }

  setState(state: VoiceState): void {
    logger.debug('mockSession.stateChanged', { from: this.state, to: state })
    this.state = state
  }

  getMockResponse(userMessage: string): Promise<string> {
    return getMockResponse(userMessage)
  }

  simulateListening(): Promise<void> {
    return new Promise((resolve) => {
      this.state = 'listening'
      logger.info('mockSession.listening.start')
      setTimeout(() => {
        this.state = 'thinking'
        logger.info('mockSession.listening.end')
        setTimeout(() => {
          resolve()
        }, 1500)
      }, 3000)
    })
  }

  simulateSpeaking(): Promise<void> {
    return new Promise((resolve) => {
      this.state = 'speaking'
      logger.info('mockSession.speaking.start')
      setTimeout(() => {
        this.state = 'ready'
        logger.info('mockSession.speaking.end')
        resolve()
      }, 4000)
    })
  }
}

export const mockSession = new MockSession()
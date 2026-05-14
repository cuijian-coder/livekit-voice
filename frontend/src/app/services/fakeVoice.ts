import type { VoiceState } from '../types/voice';
import { getMockResponse } from './mockAI';

class FakeVoiceService {
  private state: VoiceState = 'ready';

  getState(): VoiceState {
    return this.state;
  }

  setState(state: VoiceState): void {
    this.state = state;
  }

  getMockResponse(userMessage: string): Promise<string> {
    return getMockResponse(userMessage);
  }

  simulateListening(): Promise<void> {
    return new Promise((resolve) => {
      this.state = 'listening';
      setTimeout(() => {
        this.state = 'thinking';
        setTimeout(() => {
          resolve();
        }, 1500);
      }, 3000);
    });
  }

  simulateSpeaking(): Promise<void> {
    return new Promise((resolve) => {
      this.state = 'speaking';
      setTimeout(() => {
        this.state = 'ready';
        resolve();
      }, 4000);
    });
  }
}

export const fakeVoice = new FakeVoiceService();
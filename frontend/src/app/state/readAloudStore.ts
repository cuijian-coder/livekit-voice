import { getLogger } from '@livekit-voice/shared/logger'

const logger = getLogger()

export interface ReadAloudState {
  playingMessageId: string | null;
  isPlaying: boolean;
}

type Listener = (state: ReadAloudState) => void;

class ReadAloudStore {
  private state: ReadAloudState = {
    playingMessageId: null,
    isPlaying: false,
  };
  private listeners: Listener[] = [];

  getState(): ReadAloudState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.state));
  }

  setPlaying(messageId: string): void {
    logger.info('readAloud.playing', { messageId })
    this.state.playingMessageId = messageId;
    this.state.isPlaying = true;
    this.notify();
  }

  setIdle(): void {
    const previousId = this.state.playingMessageId;
    logger.info('readAloud.idle', { previousMessageId: previousId })
    this.state.playingMessageId = null;
    this.state.isPlaying = false;
    this.notify();
  }

  isPlaying(messageId: string): boolean {
    return this.state.playingMessageId === messageId && this.state.isPlaying;
  }

  getPlayingMessageId(): string | null {
    return this.state.playingMessageId;
  }
}

export const readAloudStore = new ReadAloudStore();

// Expose to window for E2E testing (DEV only)
declare global {
  interface Window {
    __READALOUD_STORE__?: typeof readAloudStore
  }
}

if (import.meta.env.DEV) {
  window.__READALOUD_STORE__ = readAloudStore
}

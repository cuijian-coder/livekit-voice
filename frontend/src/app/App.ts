import { ChatLayout } from './layout/ChatLayout';
import { uiStore } from './state/uiStore';
import { wsClient, messageRouter } from './runtime/transport';
import { ttsPlayback } from './runtime/audio/playback';
import { utteranceManager } from './runtime/audio/utterance-manager';
import { voiceActor } from './voice/providers/voice-provider';
import { getLogger } from '@livekit-voice/shared/logger';
import { LOG_LEVEL } from './runtime/config';

import './runtime/debug-provider'

const logger = getLogger()
logger.setMinLevel(LOG_LEVEL)

export class App {
  private root: HTMLElement;
  private chatLayout: ChatLayout;

  constructor(rootSelector: string) {
    const root = document.querySelector<HTMLElement>(rootSelector);
    if (!root) throw new Error(`Root element ${rootSelector} not found`);
    this.root = root;
    this.chatLayout = new ChatLayout();
    this.initTheme();
    this.mount();
  }

  private initTheme(): void {
    uiStore.subscribe((state) => {
      document.body.setAttribute('data-theme', state.theme);
    });

    const currentTheme = uiStore.getState().theme;
    document.body.setAttribute('data-theme', currentTheme);
  }

  private mount(): void {
    this.root.innerHTML = '';
    this.root.appendChild(this.chatLayout.getElement());

    ttsPlayback.init();

    wsClient.onMessage(msg => messageRouter.route(msg));
    wsClient.onBinary(data => messageRouter.routeBinary(data));

    utteranceManager.setOnInterruptedCallback(() => {
      voiceActor.send({ type: 'INTERRUPTING' } as any)
    })

    wsClient.connect()
      .then(() => {
        logger.info('transport.connected');
        messageRouter.start();
        // Send session.start for connection lifecycle
        wsClient.send({
          type: 'session.start',
          sampleRate: 16000,
          codec: 'pcm16'
        } as any)
      })
      .catch(err => logger.error('transport.connect.failed', { err }));
  }
}
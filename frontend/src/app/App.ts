import { ChatLayout } from './layout/ChatLayout';
import { uiStore } from './state/uiStore';
import { wsClient, messageRouter } from './runtime/transport';
import { ttsPlayback } from './runtime/audio/playback';
import { utteranceManager } from './runtime/audio/utterance-manager';
import { voiceActor } from './voice/providers/voice-provider';
import { getLogger } from '@livekit-voice/shared/logger';
import { LOG_LEVEL, AGENT_ENABLED } from './runtime/config';

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

    // 1. UI 初始化（同步）
    this.chatLayout = new ChatLayout();
    this.initTheme();
    this.mount();

    // 2. 运行时系统初始化（同步，不依赖网络）
    this.initRuntime();

    // 3. 网络连接（异步）
    this.connectTransport();
  }

  // ── 阶段 1: UI ─────────────────────────────────────────────

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
  }

  // ── 阶段 2: 运行时系统初始化（同步，不依赖网络）──────────────

  private initRuntime(): void {
    // 音频播放系统
    ttsPlayback.init();

    // 传输系统：绑定消息路由（不依赖连接状态）
    wsClient.onMessage(msg => messageRouter.route(msg));
    wsClient.onBinary(data => messageRouter.routeBinary(data));

    // 消息路由直接启动（内部有 isActive 控制，安全）
    messageRouter.start();

    // 语音系统：绑定回调（不依赖连接）
    utteranceManager.setOnInterruptedCallback(() => {
      voiceActor.send({ type: 'INTERRUPTING' } as any)
    })

    // TTS 播放完成 → 通知状态机
    ttsPlayback.setOnPlaybackComplete(() => {
      voiceActor.send({ type: 'playback.complete' } as any)
    })

    // Agent 模块反向注册（可选，tree-shakable）
    if (AGENT_ENABLED) {
      void import('./agent/auto-init');
    }
  }

  // ── 阶段 3: 网络连接（异步）─────────────────────────────────

  private async connectTransport(): Promise<void> {
    try {
      await wsClient.connect();
      logger.info('transport.connected');

      // 连接成功后发送会话初始化
      wsClient.send({
        type: 'session.start',
        sampleRate: 16000,
        codec: 'pcm16'
      } as any)
    } catch (err) {
      logger.error('transport.connect.failed', { err });
    }
  }
}

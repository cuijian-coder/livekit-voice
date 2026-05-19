# Frontend Architecture

## 概述

前端采用 Vanilla TypeScript + DOM API，不依赖 React/Vue 等框架。使用 XState v5 进行状态管理。

## 目录结构

```
src/app/
├── core/
│   ├── logger/              # 诊断日志系统
│   │   ├── logger.ts       # 主 Logger 类
│   │   ├── buffer.ts       # 内存缓冲
│   │   ├── types.ts        # 类型定义
│   │   └── index.ts        # 统一导出
│   └── diagnostics/        # 运行时诊断
│       ├── invariant.ts    # 断言系统
│       ├── validation.ts   # 状态验证
│       ├── timeline.ts     # 事件时间线
│       └── index.ts        # 统一导出
├── voice/
│   ├── machine/           # XState 状态机
│   │   ├── voice-machine.ts    # 状态机定义
│   │   ├── voice-context.ts    # Context 类型
│   │   ├── voice-events.ts     # Event 类型
│   │   └── index.ts
│   ├── providers/          # Actor 提供商
│   │   └── voice-provider.ts  # voiceActor 单例
│   ├── selectors/          # 派生 UI 状态
│   │   ├── actionButton.selector.ts
│   │   ├── voiceStatus.selector.ts
│   │   ├── capability.selector.ts
│   │   ├── animation.selector.ts
│   │   └── index.ts
│   └── ui/                 # UI 组件
│       ├── icons.ts
│       ├── button-config.ts
│       └── index.ts
├── runtime/                # 运行时核心模块
│   ├── constants.ts        # 音频配置常量
│   ├── session/            # 会话管理
│   │   └── index.ts
│   ├── audio/              # 音频处理
│   │   ├── recorder.ts           # AudioRecorder
│   │   ├── pcm-capture-processor.ts  # AudioWorklet processor
│   │   ├── speech-detector.ts     # SpeechDetector (VAD)
│   │   ├── utterance-manager.ts   # UtteranceManager
│   │   ├── playback.ts           # TtsPlaybackManager
│   │   └── index.ts
│   ├── transport/          # WebSocket 传输层
│   │   ├── binary-transport.ts    # 二进制帧发送
│   │   ├── websocket-client.ts    # WebSocket 客户端
│   │   ├── message-router.ts      # 消息路由
│   │   ├── protocol.ts            # 协议定义
│   │   ├── transport-state.ts     # 传输状态
│   │   ├── reconnect-manager.ts   # 重连管理
│   │   └── index.ts
│   ├── streaming/          # 流式处理
│   │   ├── controller.ts
│   │   └── index.ts
│   └── testing/            # 测试工具
│       ├── mock-session.ts
│       ├── mock-llm.ts
│       └── index.ts
├── components/             # UI 组件
│   ├── InputBar.ts
│   ├── MessageList.ts
│   └── ...
├── state/                  # 状态管理
│   ├── uiStore.ts
│   └── chatStore.ts
├── services/               # 服务层
│   ├── streaming.ts
│   ├── mockAI.ts
│   └── fakeVoice.ts
├── utils/                  # 工具函数
│   ├── dom.ts
│   ├── time.ts
│   └── id.ts
└── types/                  # 类型定义
    └── voice.ts
```

## 核心模块

### 1. Voice Machine (状态机)

职责：管理语音对话的完整生命周期

```typescript
// States: idle → listening ↔ thinking ↔ speaking
// 关键特性：
// - listening 状态下麦克风持续录音（不退出）
// - speaking → tts.complete → listening（连续对话）
// - speaking 可被 INTERRUPTING 打断

export const voiceMachine = setup({
  types: {
    context: {} as VoiceContext,
    events: {} as VoiceEvent,
  },
}).createMachine({
  id: 'voice',
  initial: 'idle',
  context: createInitialContext(),
  states: {
    idle: { ... },
    listening: {
      entry: () => startAudioRecording(),
      on: {
        'audio.commit': { target: 'thinking', ... },
        'asr.partial': { actions: 'setPartialTranscript' },
        'asr.final': { actions: 'setFinalTranscript' },
        'INTERRUPTING': { target: 'listening', actions: 'resetSession' },
      },
    },
    thinking: { ... },
    speaking: {
      entry: 'setAssistantSpeakingTrue',
      exit: 'setAssistantSpeakingFalse',
      on: {
        'INTERRUPTING': { target: 'listening', actions: 'resetSession' },
        'tts.complete': { target: 'listening' },
      },
    },
    error: { ... },
  },
});
```

### 2. SpeechDetector (VAD)

职责：语音活动检测，决定何时开始/结束语音输入

```typescript
// speech-detector.ts
export type SpeechState = 'IDLE' | 'SPEAKING' | 'POSSIBLE_END' | 'INTERRUPTING'

export class SpeechDetector {
  onFrame(float32Data: Float32Array): SpeechState

  // 配置
  setAssistantSpeaking(speaking: boolean): void  // 用于打断检测

  // 状态回调
  setStateChangeHandler(handler: SpeechStateChangeHandler): void

  reset(): void
}

// 使用示例
const detector = new SpeechDetector({
  energyThreshold: 0.01,
  silenceTimeoutMs: 600,
  minSpeechDurationMs: 300,
})
```

### 3. UtteranceManager (Turn 管理)

职责：管理 turn 生命周期，监听 SpeechDetector 状态

```typescript
// utterance-manager.ts
export class UtteranceManager {
  // 自动监听 SpeechDetector 状态变化
  // SPEAKING → startTurn()
  // POSSIBLE_END → commit()
  // INTERRUPTING → cancel()

  setOnInterruptedCallback(callback: () => void): void
  isTurnActive(): boolean
  getCurrentTurnId(): string
  reset(): void
}
```

### 4. AudioRecorder

职责：采集麦克风音频，转换为 PCM 发送

```typescript
// recorder.ts
export class AudioRecorder {
  async start(): Promise<void>
  async stop(): Promise<void>
  async flush(): Promise<void>
  resetWorkletSeq(): void
  setAudioLevelCallback(callback: AudioLevelCallback): void

  // 内部流程
  // 1. AudioWorklet → pcm-capture-processor
  // 2. onPcmData(seq, float32Data)
  // 3. speechDetector.onFrame(float32Data)  // VAD
  // 4. binaryTransport.sendFrame({ seq, pcm })  // 始终发送
}
```

### 5. BinaryTransport

职责：发送二进制音频帧到 WebSocket

```typescript
// binary-transport.ts
export class BinaryTransport {
  startTurn(turnId: string): void
  sendFrame(frame: { seq: number, pcm: Uint8Array }): void
  async flush(): Promise<void>       // 等待 bufferedAmount = 0
  async commit(): Promise<void>      // 发送 audio.commit
  cancel(): void
}
```

### 6. Voice Actor

职责：XState Actor 实例管理

```typescript
// voice-provider.ts
export const voiceActor = createActor(voiceMachine)

voiceActor.subscribe((snapshot) => {
  validateVoiceState(snapshot)
  timeline.add('state', { state: snapshot.value })
})

voiceActor.start()
```

### 7. Selectors (派生状态)

职责：从 XState snapshot 派生 UI 状态

```typescript
// actionButton.selector.ts
export function selectActionButton(snapshot: any, hasInput: boolean): ButtonViewModel {
  const state = snapshot.value as string

  if (state === 'listening') {
    return { semantic: 'stop-recording', ... }
  }
  if (state === 'speaking' || state === 'thinking') {
    return { semantic: 'interrupt', ... }
  }
  return { semantic: 'record', ... }
}
```

## 数据流

### 完整音频流程

```
User speaks
    │
    ▼
AudioRecorder (AudioWorklet)
    │
    ├─► onPcmData(seq, float32Data)
    │
    ├─► speechDetector.onFrame(float32Data)
    │         │
    │         │ SpeechDetector.SPEAKING
    │         ▼
    │    UtteranceManager.startTurn()
    │         │
    │         ├─► binaryTransport.startTurn(turnId)
    │         └─► wsClient.send({ type: 'audio.start', turnId })
    │
    ├─► binaryTransport.sendFrame({ seq, pcm })
    │         │
    │         ▼
    │    wsClient.sendBinary([seq][PCM])
    │
    ▼
600ms silence → SpeechDetector.POSSIBLE_END
    │
    ▼
UtteranceManager.commit()
    │
    ├─► binaryTransport.flush()
    ├─► binaryTransport.commit()
    │         │
    │         ▼
    │    wsClient.send({ type: 'audio.commit', turnId, finalSeq })
    │
    ▼
Backend: ASR → LLM → TTS
    │
    ▼
wsClient.onBinary(TTS chunk)
    │
    ▼
ttsPlayback.onChunk(pcmData)
```

### 打断流程

```
speaking state + ttsPlayback playing
    │
    │ User speaks (SpeechDetector detects energy > threshold)
    │
    ▼
SpeechDetector.setAssistantSpeaking(true) + onFrame()
    │
    ▼
SpeechDetector → INTERRUPTING
    │
    ▼
UtteranceManager.cancel()
    │
    ├─► binaryTransport.cancel()
    ├─► wsClient.send({ type: 'turn.cancel', turnId })
    └─► onInterruptedCallback() → voiceActor.send({ type: 'INTERRUPTING' })
    │
    ▼
speaking → listening (via INTERRUPTING transition)
    │
    ▼
Recording continues, speechDetector resets to IDLE
```

## 常量配置

```typescript
// runtime/constants.ts
export const AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  micEnergyThreshold: 0.01,     // RMS threshold for speech detection
  silenceTimeoutMs: 600,        // 600ms silence → auto commit
  minSpeechDurationMs: 300,     // Minimum speech to count as valid
}

export const TRANSPORT_CONFIG = {
  flushTimeoutMs: 5000,
  maxRetries: 3,
}
```

## 测试策略

### 单元测试

| 模块 | 测试文件 | 覆盖 |
|------|----------|------|
| SpeechDetector | speech-detector.test.ts | ✅ 17 tests |
| Voice Machine | voice-machine.test.ts | ✅ 26 tests |
| Logger | logger.test.ts, buffer.test.ts | ✅ |
| Diagnostics | invariant.test.ts, validation.test.ts, timeline.test.ts | ✅ |
| Selectors | actionButton.selector.test.ts, etc. | ✅ |
| Utils | time.test.ts, id.test.ts | ✅ |

### 运行测试

```bash
cd frontend
pnpm test:run    # 单次运行
pnpm test        # watch 模式
```

当前：186 tests passing

## 浏览器兼容性

| 特性 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| XState v5 | ✅ 80+ | ✅ 80+ | ✅ 15+ | ✅ 80+ |
| DOM API | ✅ | ✅ | ✅ | ✅ |
| Web Audio | ✅ | ✅ | ✅ | ✅ |
| AudioWorklet | ✅ 66+ | ✅ 76+ | ✅ 14.1+ | ✅ 79+ |

## 性能优化

1. **Selector 派生** - 只在需要时计算 UI 状态
2. **Logger 缓冲** - 内存缓冲，不阻塞主线程
3. **XState 优化** - 最小状态转换
4. **Binary 传输** - 直接发送二进制帧，无 base64 编码
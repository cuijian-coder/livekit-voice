# Backend Architecture

## 概述

后端是一个 **Realtime AI Voice Runtime**，采用流式优先、可中断、事件驱动的架构。每个连接用户拥有独立的 `VoiceSession`，管理完整的语音对话生命周期。

## 架构分层

```
Frontend Runtime
        ↕ WebSocket
Realtime Gateway
        ↕ Events
VoiceSession Runtime
        ↕
AI Workers
├── ASR (通义千问)
├── LLM (通义千问 Qwen)
└── TTS (通义千问 TTS)
```

## 目录结构

```
server/
├── src/
│   ├── gateway/                    # WebSocket 网关
│   │   ├── server.ts               # WebSocket 服务器
│   │   ├── protocol/               # 协议编解码
│   │   │   ├── messages.ts         # 消息类型定义
│   │   │   └── codec.ts            # 序列化/反序列化
│   │   └── handlers/               # 连接处理器
│   │       └── session-handler.ts
│   │
│   ├── runtime/                     # 核心运行时
│   │   ├── voice-session/          # 会话管理
│   │   │   ├── voice-session.ts    # VoiceSession 主类
│   │   │   ├── session-manager.ts  # 会话管理器
│   │   │   └── types.ts            # 会话类型
│   │   ├── state-machine/          # XState 状态机
│   │   │   ├── conversation-machine.ts
│   │   │   ├── context.ts
│   │   │   └── events.ts
│   │   ├── playback/               # 回放系统
│   │   │   └── playback-queue.ts
│   │   ├── interruption/           # 打断处理
│   │   │   └── interruption-handler.ts
│   │   └── diagnostics/            # 运行时诊断
│   │       └── diagnostics-collector.ts
│   │
│   ├── workers/                     # AI Workers (无状态适配器)
│   │   ├── asr/                    # 流式 ASR
│   │   │   └── qwen-asr.worker.ts
│   │   ├── llm/                    # 流式 LLM
│   │   │   └── qwen-llm.worker.ts
│   │   └── tts/                    # 流式 TTS
│   │       ├── qwen-tts.worker.ts        # DashScope CosyVoice (预留)
│   │       ├── nls-gateway-tts.worker.ts  # NLS HTTP 异步轮询
│   │       └── aliyun-streaming-tts.worker.ts  # NLS WebSocket 流式
│   │
│   ├── shared/                     # 共享模块
│   │   ├── constants.ts            # 规范常量
│   │   ├── events.ts               # 事件类型定义
│   │   └── types.ts                # 共享类型
│   │
│   ├── infra/                      # 基础设施
│   │   ├── config/                 # 配置加载
│   │   │   └── config.ts
│   │   └── startup/                # 启动流程
│   │       └── index.ts
│   │
│   ├── app.ts                      # Fastify 实例
│   └── main.ts                     # 入口
│
├── package.json
├── tsconfig.json
└── .env
```

## 核心模块

### 1. VoiceSession (会话运行时)

**职责**: 管理单个会话的完整生命周期、状态、编排。

```typescript
class VoiceSession {
  sessionId: string
  websocket: WebSocket

  stateMachine: Actor<any>

  currentTurnId: string
  audioBuffer: Int16Array[]
  playbackQueue: PlaybackQueue
  abortControllers: Map<string, AbortController>
  diagnostics: DiagnosticsCollector

  // 核心方法
  handleAudioChunk(chunk: Buffer): void
  handleInterrupt(): void
  handleAsrResult(text: string, isFinal: boolean): void
  handleLlmToken(token: string): void
  handleTtsChunk(audio: Buffer): void
  transitionTo(state: ConversationState): void
  abortAll(): void
  recover(): Promise<void>
}
```

### 2. SessionManager (会话管理)

**职责**: 管理所有活跃会话，路由 WebSocket 连接。

```typescript
class SessionManager {
  private sessions: Map<string, VoiceSession>

  create(ws: WebSocket): VoiceSession
  get(sessionId: string): VoiceSession | undefined
  destroy(sessionId: string): void
}
```

### 3. XState State Machine (状态机)

**职责**: 管理高层对话状态转换。

**规范状态**:

```typescript
type ConversationState =
  | 'idle'       // 空闲
  | 'listening'  // 正在听
  | 'transcribing' // 正在转写
  | 'thinking'   // AI 思考中
  | 'speaking'   // AI 说话中
  | 'interrupting' // 打断中
  | 'recovering' // 恢复中
  | 'error'      // 错误
```

**状态转换图**:

```
                      ┌─────────────────────────────────────┐
                      │              idle                    │
                      │  (等待用户开始)                       │
                      └─────────────┬───────────────────────┘
                                    │ START
                                    ▼
                      ┌─────────────────────────────────────┐
                      │           listening                 │
                      │  (VAD 检测中，等待语音结束)           │
                      └─────────────┬───────────────────────┘
                                    │ VAD_END
                                    ▼
                      ┌─────────────────────────────────────┐
                      │          transcribing                │
                      │  (ASR 流式处理中)                    │
                      └─────────────┬───────────────────────┘
                                    │ ASR_COMPLETE
                                    ▼
                      ┌─────────────────────────────────────┐
                      │            thinking                  │
                      │  (LLM 流式生成中)                    │
                      └─────────────┬───────────────────────┘
                                    │ LLM_COMPLETE
                                    ▼
                      ┌─────────────────────────────────────┐
                      │            speaking                  │
                      │  (TTS 流式输出音频)                   │
                      └─────────────┬───────────────────────┘
                                    │ SPEAK_COMPLETE
                                    ▼
                               idle

          ┌─────────────────────────────────────────────────┐
          │                   打断路径                        │
          └─────────────┬───────────────────────────────────┘
                        │ INTERRUPT (任意状态)
                        ▼
          ┌─────────────────────────────────────┐
          │          interrupting                │
          │  (停止播放、取消 TTS/LLM、重置状态)    │
          └─────────────┬───────────────────────┘
                        │ (完成清理)
                        ▼
                       idle
```

### 4. PlaybackQueue (回放队列)

**职责**: 队列化管理 TTS 音频流，支持中断和 underrun 检测。

```typescript
class PlaybackQueue {
  private queue: Buffer[]

  enqueue(chunk: Buffer): void
  clear(): void
  drain(): Buffer | null
  isEmpty(): boolean
  getUnderrunCount(): number
}
```

### 5. AI Workers (Workers)

Workers 是无状态适配器，仅负责 AI 推理调用。

#### ASR Worker

```typescript
interface AsrWorker {
  stream(
    audioStream: AsyncIterable<Buffer>,
    signal: AbortSignal
  ): AsyncIterable<{ text: string; isFinal: boolean }>
}
```

#### LLM Worker

```typescript
interface LlmWorker {
  stream(
    prompt: string,
    signal: AbortSignal
  ): AsyncIterable<string>
}
```

#### TTS Worker

```typescript
interface TtsWorker {
  stream(
    textStream: AsyncIterable<string>,
    signal: AbortSignal
  ): AsyncIterable<Buffer>
}
```

## 事件驱动架构

后端编排完全基于事件驱动，不使用 XState 管理音频流/Token 流/回放队列。

**规范事件名**:

```typescript
type RuntimeEvent =
  | 'audio.chunk.received'    // 收到音频块
  | 'vad.started'             // VAD 开始
  | 'vad.ended'               // VAD 结束
  | 'asr.partial'             // ASR 部分结果
  | 'asr.final'               // ASR 最终结果
  | 'llm.started'             // LLM 开始
  | 'llm.token'               // LLM Token
  | 'llm.completed'           // LLM 完成
  | 'tts.started'             // TTS 开始
  | 'tts.chunk'               // TTS 音频块
  | 'tts.completed'           // TTS 完成
  | 'playback.started'        // 回放开始
  | 'playback.completed'      // 回放完成
  | 'playback.underrun'       // 回放欠载
  | 'interrupt.detected'      // 检测到打断
  | 'runtime.error'           // 运行时错误
```

## 流式管道

### 有效管道

```
audio stream
  → ASR partials
  → LLM token stream
  → incremental TTS
  → audio playback chunks
```

### 禁止模式

```
full transcript
  → full response
  → full TTS
  → playback
```

## WebSocket 协议

### 帧类型

| 类型 | 编码 | 用途 |
|------|------|------|
| Audio | Binary | 音频块传输 |
| JSON Message | Text | 运行时事件、状态更新、控制信号 |

### JSON 消息格式

```typescript
// Server → Client
type ServerMessage =
  | { type: 'state.update'; state: ConversationState; turnId: string }
  | { type: 'asr.partial'; text: string; turnId: string }
  | { type: 'asr.final'; text: string; turnId: string }
  | { type: 'playback.started'; turnId: string }
  | { type: 'playback.completed'; turnId: string }
  | { type: 'runtime.error'; error: string }
  | { type: 'diagnostics'; metrics: Diagnostics }

// Client → Server
type ClientMessage =
  | { type: 'audio'; data: string /* base64 */; turnId: string }
  | { type: 'interrupt' }
  | { type: 'ping' }
  | { type: 'session.init'; sessionId?: string }
```

### 二进制帧

音频块直接以二进制 WebSocket 帧传输，不包裹 JSON。

## 打断处理

打断是一等公民特性：

```
1. 停止回放
2. 清空回放队列
3. 取消 TTS (abort TTS AbortController)
4. 取消 LLM (abort LLM AbortController)
5. 重置运行时状态
6. 切换到 listening
```

## 诊断系统

每个 VoiceSession 维护诊断数据：

```typescript
interface Diagnostics {
  stateTransitions: Array<{ from: string; to: string; ts: number }>
  interruptions: Array<{ turnId: string; reason: string; ts: number }>
  websocketReconnects: number
  audioUnderruns: number
  streamErrors: Array<{ worker: string; error: string; ts: number }>

  latency: {
    asrStart: number | null    // ms
    llmFirstToken: number | null
    ttsFirstChunk: number | null
    playbackStart: number | null
  }
}
```

诊断记录必须异步，不阻塞运行时执行。

## 错误恢复策略

恢复优先顺序：

```
recover stream      → 重新启动当前 Worker 流
  → recover pipeline → 重建完整管道
    → recover session  → 重置会话状态
      → reconnect websocket → 重建连接
        → fatal error       → 记录并关闭会话
```

## 与前端的状态对应

| 前端状态 | 后端状态 | 说明 |
|----------|----------|------|
| idle | idle | 空闲 |
| listening | listening + transcribing | 录音+转写 |
| thinking | thinking | AI 处理 |
| streaming | speaking | TTS 输出中 |
| playing | speaking | 回放中 |

## 日志系统

使用 pino (Fastify 默认)，分级输出：

```bash
DEBUG  # 详细调试
INFO   # 一般信息
WARN   # 警告
ERROR  # 错误
```

运行时关键事件均记录日志，格式为结构化 JSON。
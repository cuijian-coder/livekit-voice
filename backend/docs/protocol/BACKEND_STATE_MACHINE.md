# Backend State Machine

## 概述

后端使用 XState v5 管理高层对话生命周期**（不管理音频流/Token 流/回放队列，那些是事件驱动的）**。

## 规范状态

```typescript
type ConversationState =
  | 'idle'           // 空闲，等待用户
  | 'listening'      // VAD 检测中，等待语音结束
  | 'transcribing'   // ASR 流式处理中
  | 'thinking'       // LLM 流式生成中
  | 'speaking'       // TTS 流式输出 + 回放中
  | 'interrupting'   // 打断处理中
  | 'recovering'     // 错误恢复中
  | 'error'          // 错误状态
```

## 状态转换图

```
                          idle
                            │
                            │ START
                            ▼
                      ┌───────────┐
                      │ listening │
                      └─────┬─────┘
                            │ VAD_END
                            ▼
                      ┌─────────────┐
                      │transcribing │
                      └──────┬──────┘
                             │ ASR_COMPLETE
                             ▼
                      ┌───────────┐
                      │ thinking  │
                      └─────┬─────┘
                            │ LLM_COMPLETE
                            ▼
                      ┌───────────┐
                      │ speaking  │
                      └─────┬─────┘
                            │ SPEAK_COMPLETE
                            ▼
                          idle

  ┌──────────────────────────────────────┐
  │            打断路径 (任意状态)        │
  └──────────────┬───────────────────────┘
                 │ INTERRUPT
                 ▼
         ┌─────────────┐
         │interrupting │
         └──────┬──────┘
                │ (清理完成)
                ▼
               idle

  ┌──────────────────────────────────────┐
  │             错误路径                   │
  └──────────────┬───────────────────────┘
                 │ ERROR
                 ▼
         ┌─────────────┐
         │  recovering │
         └──────┬──────┘
                │ (恢复成功/失败)
                ▼
          idle 或 error
```

## Context 结构

```typescript
interface ConversationContext {
  sessionId: string
  turnId: string
  transcript: string
  partialTranscript: string
  responseBuffer: string
  diagnostics: DiagnosticsCollector
  abortControllers: Map<string, AbortController>
}
```

## 事件类型

```typescript
type ConversationEvent =
  | { type: 'START' }
  | { type: 'VAD_END' }
  | { type: 'ASR_COMPLETE'; text: string }
  | { type: 'LLM_COMPLETE' }
  | { type: 'SPEAK_COMPLETE' }
  | { type: 'INTERRUPT' }
  | { type: 'ERROR'; error: string }
  | { type: 'RECOVER' }
```

## 状态职责

| 状态 | 进入条件 | 退出条件 | 核心动作 |
|------|---------|---------|---------|
| idle | 系统启动 / speak 完成 / interrupt 完成 | START | 等待连接 |
| listening | START | VAD_END | 接收音频流 |
| transcribing | VAD_END | ASR_COMPLETE | 调用 ASR Worker |
| thinking | ASR_COMPLETE | LLM_COMPLETE | 调用 LLM Worker |
| speaking | LLM_COMPLETE | SPEAK_COMPLETE | 调用 TTS Worker + 回放 |
| interrupting | INTERRUPT | (自动) | 取消所有 Worker + 清理队列 |
| recovering | ERROR | RECOVER | 尝试恢复 |
| error | 恢复失败 | (需重置) | 记录错误 |

## 与前端状态映射

| 前端状态 | 后端状态 | 差异 |
|----------|----------|------|
| idle | idle | 一致 |
| listening | listening + transcribing | 前端合并为 listening |
| thinking | thinking | 一致 |
| streaming | speaking | 命名不同 |
| playing | speaking | 前端有单独的 playing |

## Guard 条件

```typescript
// listening → transcribing: 需要音频数据
{ type: 'VAD_END', hasAudio: true }

// thinking → speaking: 需要非空响应
{ type: 'LLM_COMPLETE', responseLength: number }

// speaking → idle: 需要回放完成
{ type: 'SPEAK_COMPLETE' }
```

## Actions (副作用)

| 状态 | Actions |
|------|---------|
| listening | 初始化 turnId, 启动 VAD 监听 |
| transcribing | 启动 ASR Worker, 记录 asrStart latency |
| thinking | 启动 LLM Worker, 记录 llmFirstToken latency |
| speaking | 启动 TTS Worker, 初始化 PlaybackQueue, 记录 ttsFirstChunk latency |
| interrupting | 调用 abortAll(), 清空 PlaybackQueue, 记录打断 |
| recovering | 尝试恢复当前 Worker 流 |

## XState 配置

```typescript
import { setup, assign, fromCallback } from 'xstate'

const conversationMachine = setup({
  types: {
    context: {} as ConversationContext,
    events: {} as ConversationEvent,
  },
  actions: {
    initTurn: assign({ turnId: () => generateTurnId() }),
    recordAsrStart: ({ context }) => context.diagnostics.recordAsrStart(),
    recordLlmFirstToken: ({ context }) => context.diagnostics.recordLlmFirstToken(),
    recordTtsFirstChunk: ({ context }) => context.diagnostics.recordTtsFirstChunk(),
    abortAll: ({ context }) => context.abortControllers.forEach(c => c.abort()),
    clearQueue: ({ context }) => context.playbackQueue.clear(),
  },
  guards: {
    hasAudio: (_, params: { hasAudio: boolean }) => params.hasAudio,
    hasResponse: (_, params: { responseLength: number }) => params.responseLength > 0,
  },
}).createMachine({
  id: 'conversation',
  initial: 'idle',
  context: createInitialContext(),
  states: {
    idle: {
      on: { START: 'listening' },
    },
    listening: {
      entry: 'initTurn',
      on: { VAD_END: 'transcribing' },
    },
    transcribing: {
      entry: 'recordAsrStart',
      on: { ASR_COMPLETE: 'thinking' },
    },
    thinking: {
      entry: 'recordLlmFirstToken',
      on: { LLM_COMPLETE: 'speaking' },
    },
    speaking: {
      entry: 'recordTtsFirstChunk',
      on: { SPEAK_COMPLETE: 'idle' },
    },
    interrupting: {
      entry: ['abortAll', 'clearQueue'],
      always: 'idle',
    },
    recovering: {
      on: { RECOVER: 'idle' },
    },
    error: {
      on: { START: 'idle' },
    },
  },
})
```

## 验证规则

### 状态约束

| 状态 | 必填字段 |
|------|---------|
| 所有状态 | sessionId |
| listening | turnId |
| transcribing | turnId |
| thinking | turnId, transcript |
| speaking | turnId, transcript, responseBuffer |

### 转换验证

```
idle → listening        ✅
idle → thinking        ✅
idle → speaking        ❌
idle → interrupting    ❌
listening → transcribing ✅
listening → interrupting ✅ (打断)
transcribing → thinking  ✅
transcribing → interrupting ✅
thinking → speaking     ✅
thinking → interrupting ✅
speaking → idle         ✅
speaking → interrupting ✅
error → idle            ✅
```

## 不使用 XState 管理的领域

以下领域完全基于事件驱动，不经过 XState：

1. **音频数据块** - 直接通过 `audio.chunk.received` 事件流
2. **LLM Token 流** - 直接通过 `llm.token` 事件流
3. **TTS 音频块** - 直接通过 `tts.chunk` 事件流
4. **Playback 队列** - PlaybackQueue 类自行管理
5. **ASR partials** - 直接通过 `asr.partial` 事件流
6. **心跳** - 独立的 ping/pong 协议
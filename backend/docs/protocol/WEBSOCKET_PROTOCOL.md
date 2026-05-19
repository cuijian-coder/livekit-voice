# WebSocket Protocol

## 概述

前后端通过 WebSocket 进行双向通信，支持二进制音频流和 JSON 消息。采用**连续对话**协议，音频帧实时发送，turn 通过 silence timeout 自动结束。

## 连接建立

### 建立连接

```
Client                            Server
  │                                  │
  │──── WSS Connect ────────────────▶│
  │                                  │
  │◀─── WebSocket Open ─────────────│
  │                                  │
  │──── session.start ─────────────▶│
  │      { sampleRate: 16000,        │
  │        codec: 'pcm16' }          │
  │                                  │
  │◀─── session.started ────────────│
  │      { sessionId, state: idle }  │
```

## 帧类型

| 帧类型 | 编码 | 说明 |
|--------|------|------|
| Binary | Opcode 2 | 音频数据块 [seq(4bytes)][PCM] |
| Text | Opcode 1 | JSON 消息 |

## 消息格式

### Server → Client

```typescript
type ServerMessage =
  // 会话
  | { type: 'session.started'; sessionId: string; state: ConversationState }
  | { type: 'session.error'; error: string; code: number }

  // 状态
  | { type: 'state.update'; state: ConversationState; turnId: string }

  // ASR (Streaming)
  | { type: 'asr.partial'; text: string; turnId: string; seq: number }
  | { type: 'asr.final'; text: string; turnId: string }

  // LLM
  | { type: 'llm.started' }
  | { type: 'llm.token'; token: string }
  | { type: 'llm.complete' }

  // TTS
  | { type: 'tts.started' }
  | { type: 'tts.complete' }

  // 回放
  | { type: 'playback.completed'; turnId: string; interrupted?: boolean }

  // 错误与诊断
  | { type: 'runtime.error'; error: string; code: number }
  | { type: 'diagnostics'; metrics: DiagnosticsSnapshot }
  | { type: 'pong' }
```

### Client → Server

```typescript
type ClientMessage =
  // 会话
  | { type: 'session.start'; sampleRate: number; codec: string }

  // 音频
  | { type: 'audio.start'; turnId: string }           // Turn 开始
  | { type: 'audio.commit'; turnId: string; finalSeq: number }  // Turn 结束
  | { type: 'turn.cancel'; turnId: string }           // 打断取消

  // Binary audio frame: [seq: uint32 LE][PCM: int16[]]
  // 每帧实时发送，不等待 commit

  // 控制
  | { type: 'interrupt' }
  | { type: 'ping' }
  | { type: 'submit.text'; text: string }
```

## 连续对话流程

### 完整 Turn 流程

```
Client                         Server                       AI Pipeline
  │                              │                              │
  │── audio.start ──────────────▶│                              │
  │      { turnId }              │                              │
  │                              │                              │
  │── [seq=0][PCM] ──────────────▶│                              │ ASR worker
  │── [seq=1][PCM] ──────────────▶│── asr.partial ──────────────▶│ 接收帧
  │── [seq=2][PCM] ──────────────▶│── asr.partial (seq=2, text) ◀──│
  │◀── asr.partial ──────────────│                              │
  │      { turnId, seq, text }   │                              │
  │         ...                  │                              │
  │                              │                              │
  │  (600ms silence → auto commit)                              │
  │                              │                              │
  │── audio.commit ─────────────▶│                              │
  │      { turnId, finalSeq }    │── asr.final ────────────────▶│
  │                              │◀── asr.final ────────────────│
  │                              │                              │
  │                              │── llm.started ──────────────▶│
  │◀── llm.started ─────────────│                              │
  │                              │── llm.token ────────────────▶│
  │◀── llm.token ◀───────────────│                              │
  │                              │                              │
  │                              │── tts.started ──────────────▶│
  │◀── tts.started ─────────────│                              │
  │                              │── [binary TTS] ─────────────▶│
  │◀── [binary audio] ◀──────────│                              │
  │◀── tts.complete ────────────│── tts.complete ──────────────▶│
  │                              │                              │
  │◀── state.update(listening) ──│  (回到 listening，继续录音)  │
```

### 打断/插话流程

```
speaking (TTS playing)
    │
    │ User speaks while assistant speaking
    ▼
Client                         Server                       AI Pipeline
  │                              │                              │
  │── [speech detected] ─────────│                              │
  │── turn.cancel ──────────────▶│                              │
  │      { turnId }              │                              │
  │                              │── tts.cancel                 │
  │                              │── llm.abort()                │
  │                              │                              │
  │◀── playback.completed ──────│── (interrupted: true)        │
  │      { interrupted: true }   │                              │
  │                              │                              │
  │◀── state.update(listening) ──│                              │
  │                              │                              │
  │── audio.start (new turn) ───▶│                              │
  │      { newTurnId }           │                              │
  │         ...                  │                              │
```

### Binary Frame 格式

```
Offset 0-3:   seq (uint32, little-endian)
Offset 4+:    PCM (int16[], little-endian)

每帧: 4 bytes seq + (samples * 2) bytes PCM
例如: 128 samples = 4 + 256 = 260 bytes
```

## 状态转换

### Backend ConversationState

| 状态 | 描述 |
|------|------|
| idle | 空闲，等待用户 |
| listening | 接收音频中 |
| thinking | 处理 ASR 结果中 |
| speaking | TTS 播放中 |
| interrupted | 被用户打断 |

### Frontend VoiceState

| 状态 | 描述 |
|------|------|
| idle | 空闲 |
| listening | 持续录音中 |
| thinking | 等待助手响应 |
| speaking | 助手 TTS 播放中 |

## 错误码

| Code | 描述 |
|------|------|
| 4001 | 无效消息格式 |
| 4002 | Session 不存在 |
| 4003 | 流处理错误 |
| 4004 | AI 服务错误 |
| 5001 | 服务端内部错误 |

## 心跳

客户端每 30 秒发送 `ping`，服务端回应 `pong`。

```json
// Client → Server
{ "type": "ping" }

// Server → Client
{ "type": "pong" }
```

## 消息大小限制

- JSON 消息：最大 4KB
- Binary 音频帧：最大 64KB

## Streaming ASR 说明

后端接收每个 binary frame 后立即加入队列，由独立任务流式发送给 ASR 服务：

```
handleBinaryFrame(pcmData, seq)
    │
    ▼
asrFrameQueue.push(pcmData)  // 加入队列
    │
    ▼
StreamingAsrTask (异步)
    │
    ▼
for await (result of asrWorker.stream(frameStream)):
    │
    ▼
asr.partial { turnId, seq, text }  // 实时返回
```

## Turn 生命周期

```
audio.start (turnId)           Turn 开始
    │
    ├─ frames 实时发送
    │
    ▼
audio.commit (turnId, finalSeq)  Turn 结束（自动或手动）
    │
    ├─ asr.final 返回
    ├─ llm 推理
    └─ tts 生成
    │
    ▼
turn.cancel (turnId)           Turn 取消（打断）
```
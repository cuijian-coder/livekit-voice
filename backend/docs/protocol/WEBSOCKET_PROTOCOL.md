# WebSocket Protocol

## 概述

前后端通过 WebSocket 进行双向通信，支持二进制音频流和 JSON 消息。

## 连接建立

### 建立连接

```
Client                            Server
  │                                  │
  │──── WSS Connect ────────────────▶│
  │                                  │
  │◀─── WebSocket Open ─────────────│
  │                                  │
  │──── session.init ──────────────▶│
  │      { sessionId? }              │
  │                                  │
  │◀─── session.established ────────│
  │      { sessionId, state: idle }  │
```

### Session ID

- 首次连接：`sessionId` 可选，服务端生成
- 断线重连：携带原有 `sessionId`，服务端恢复会话

## 帧类型

| 帧类型 | 编码 | 说明 |
|--------|------|------|
| Binary | Opcode 2 | 音频数据块 |
| Text | Opcode 1 | JSON 消息 |

## 消息格式

### Server → Client

```typescript
type ServerMessage =
  // 会话
  | { type: 'session.established'; sessionId: string; state: ConversationState }
  | { type: 'session.error'; error: string; code: number }

  // 状态
  | { type: 'state.update'; state: ConversationState; turnId: string }

  // ASR
  | { type: 'asr.partial'; text: string; turnId: string }
  | { type: 'asr.final'; text: string; turnId: string }

  // 回放
  | { type: 'playback.started'; turnId: string }
  | { type: 'playback.chunk'; /* binary frame follows */ }
  | { type: 'playback.completed'; turnId: string }
  | { type: 'playback.underrun'; turnId: string }

  // 错误与诊断
  | { type: 'runtime.error'; error: string; code: number }
  | { type: 'diagnostics'; metrics: DiagnosticsSnapshot }
  | { type: 'pong' }
```

### Client → Server

```typescript
type ClientMessage =
  // 会话
  | { type: 'session.init'; sessionId?: string }

  // 音频
  | { type: 'audio'; data: string; turnId: string; /* binary audio follows */ }
  | { type: 'vad.end' }                    // 通知 VAD 结束（客户端 VAD）
  | { type: 'vad.start' }                  // 通知 VAD 开始

  // 控制
  | { type: 'interrupt' }
  | { type: 'ping' }
```

## 状态转换流程

### 完整对话流程

```
Client                         Server                       AI Pipeline
  │                              │                              │
  │── audio (binary) ────────────▶│                              │
  │                              │── audio.chunk.received ──────▶│
  │                              │              VAD_END          │
  │                              │── asr.partial ───────────────▶│
  │◀── asr.partial ──────────────│                              │
  │                              │                              │
  │                              │── asr.final ────────────────▶│
  │◀── asr.final ───────────────│── llm.started ──────────────▶│
  │◀── state.update(thinking) ──│                              │
  │                              │── llm.token ────────────────▶│
  │◀── (stream tokens) ──────────│                              │
  │                              │── tts.started ──────────────▶│
  │◀── playback.started ─────────│── tts.chunk ────────────────▶│
  │◀── audio (binary) ──────────│                              │
  │◀── playback.chunk ──────────│                              │
  │      ...                     │── tts.completed ────────────▶│
  │◀── playback.completed ──────│── playback.completed         │
  │◀── state.update(idle) ──────│                              │
```

### 打断流程

```
Client                         Server
  │                              │
  │── interrupt ─────────────────▶│
  │                              │── playback.stop
  │                              │── tts.cancel
  │                              │── llm.cancel
  │                              │── state: interrupting
  │                              │── state: idle
  │◀── state.update(idle) ──────│
  │◀── playback.completed ──────│  (with interrupted: true)
```

### 错误恢复流程

```
Server                         AI Pipeline
  │                              │
  │── stream error ──────────────▶│
  │                              │── recover stream
  │◀── recovered ───────────────│
  │◀── state.update(recovering) ─│
  │◀── state.update(idle) ──────│
```

## Audio 帧格式

- 采样率：16kHz
- 位深：16-bit
- 编码：PCM (signed int16)
- 每帧长度：建议 20-100ms（320-1600 字节 @ 16kHz）

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

## 序列化

JSON 消息使用 UTF-8 编码。Binary 音频帧直接传输，不做 base64 包装（节省带宽）。
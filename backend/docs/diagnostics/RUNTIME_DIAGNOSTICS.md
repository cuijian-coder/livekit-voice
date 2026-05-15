# Runtime Diagnostics

## 概述

运行时诊断系统为每个 VoiceSession 提供可观测性，用于监控延迟、追踪状态转换、记录错误和性能指标。

## DiagnosticsCollector

每个 VoiceSession 持有一个 `DiagnosticsCollector` 实例：

```typescript
class DiagnosticsCollector {
  private stateTransitions: TransitionRecord[] = []
  private interruptions: InterruptRecord[] = []
  private streamErrors: StreamError[] = []

  private websocketReconnects = 0
  private audioUnderruns = 0

  private latency: LatencyMetrics = {
    asrStart: null,
    llmFirstToken: null,
    ttsFirstChunk: null,
    playbackStart: null,
  }

  private turnStartTime: number | null = null
}
```

## 指标类型

### 1. 状态转换

```typescript
interface TransitionRecord {
  from: ConversationState | null
  to: ConversationState
  ts: number  // timestamp
}
```

记录每次 XState 状态机转换，用于分析对话流程和性能。

### 2. 打断事件

```typescript
interface InterruptRecord {
  turnId: string
  reason: 'user' | 'error' | 'timeout'
  ts: number
}
```

记录所有打断事件，包括打断发生的时机和原因。

### 3. 流错误

```typescript
interface StreamError {
  worker: 'asr' | 'llm' | 'tts'
  error: string
  ts: number
}
```

记录 AI Worker 的错误，不阻塞运行时执行。

### 4. 延迟指标

```typescript
interface LatencyMetrics {
  asrStart: number | null       // 从 audio.chunk.received 到 ASR 首字 ms
  llmFirstToken: number | null   // 从 asr.final 到 LLM 首 Token ms
  ttsFirstChunk: number | null   // 从 LLM_COMPLETE 到 TTS 首音频块 ms
  playbackStart: number | null  // 从 tts.chunk 到 playback.chunk ms
}
```

### 5. 计数器

```typescript
websocketReconnects: number   // WebSocket 重连次数
audioUnderruns: number        // 回放欠载次数
```

## 记录时机

| 指标 | 记录时机 |
|------|---------|
| stateTransitions | XState 状态转换时 |
| interruptions | INTERRUPT 事件触发时 |
| streamErrors | Worker 抛出错误时 |
| asrStart | transcribing 状态进入时 |
| llmFirstToken | 收到首个 LLM token 时 |
| ttsFirstChunk | 收到首个 TTS 音频块时 |
| playbackStart | 首个音频块进入 PlaybackQueue 时 |
| audioUnderruns | PlaybackQueue.drain() 返回 null 且队列为空时 |
| websocketReconnects | WebSocket 重连成功时 |

## 获取诊断快照

```typescript
interface DiagnosticsSnapshot {
  stateTransitions: TransitionRecord[]
  interruptions: InterruptRecord[]
  websocketReconnects: number
  audioUnderruns: number
  streamErrors: StreamError[]
  latency: LatencyMetrics
}

// 获取完整快照
collector.getSnapshot(): DiagnosticsSnapshot

// 获取摘要（用于日志）
collector.getSummary(): {
  totalTransitions: number
  totalInterruptions: number
  totalErrors: number
  p50Latency: LatencyMetrics
}
```

## 服务端主动推送

服务端定期或按需向客户端推送诊断快照：

```json
{
  "type": "diagnostics",
  "metrics": {
    "stateTransitions": [...],
    "interruptions": [...],
    "websocketReconnects": 0,
    "audioUnderruns": 0,
    "streamErrors": [],
    "latency": {
      "asrStart": 120,
      "llmFirstToken": 350,
      "ttsFirstChunk": 80,
      "playbackStart": 45
    }
  }
}
```

推送时机：
- 每次 `state.update` 时附带摘要
- 客户端请求时 (`client.getDiagnostics`)
- 定时推送（可选，生产环境关闭）

## 日志集成

诊断系统与 pino 日志集成：

```typescript
// 状态转换日志
logger.info('state.transition', {
  sessionId,
  from: 'listening',
  to: 'transcribing',
  latency: metrics,
})

// 打断日志
logger.warn('session.interrupt', {
  sessionId,
  turnId,
  reason: 'user',
  stage: 'thinking',
})

// 错误日志
logger.error('stream.error', {
  sessionId,
  worker: 'llm',
  error: 'connection_timeout',
})
```

## 客户端诊断

前端可请求诊断数据用于调试：

```json
// Client → Server
{ "type": "getDiagnostics" }

// Server → Client
{ "type": "diagnostics", "metrics": {...} }
```

## 非阻塞设计

所有诊断记录操作必须异步，不阻塞运行时执行：

```typescript
// ✅ 正确 - 异步记录
setImmediate(() => {
  this.stateTransitions.push(record)
})

// ❌ 错误 - 同步记录可能阻塞
this.stateTransitions.push(record)
```

## 未来计划

- [ ] 结构化延迟分布 (p50, p95, p99)
- [ ] 实时指标导出 (Prometheus 格式)
- [ ] 追踪 ID 关联 (OpenTelemetry)
- [ ] 客户端本机诊断上报
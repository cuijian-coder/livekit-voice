# Testing Strategy

## 概述

测试策略以可验证性 + 可维护性为核心，使用 Vitest 覆盖核心模块。

## 测试金字塔

```
          ┌─────────────────────────────────────┐
          │      E2E Tests (WebSocket)          │  ← 手动/CI
          ├─────────────────────────────────────┤
          │       Integration Tests             │  ← VoiceSession 流程
          ├─────────────────────────────────────┤
          │         Unit Tests                  │  ← Vitest
          ├─────────────────────────────────────┤
          │          Lint + TypeCheck           │  ← CI
          └─────────────────────────────────────┘
```

## 测试覆盖

### Phase 1 目标覆盖

| 模块 | 测试文件 | 覆盖目标 |
|------|----------|---------|
| State Machine | state-machine/*.test.ts | 状态转换、guards、actions |
| VoiceSession | voice-session/*.test.ts | 会话生命周期、事件处理 |
| PlaybackQueue | playback/*.test.ts | 队列操作、中断、underrun |
| Diagnostics | diagnostics/*.test.ts | 指标记录、快照 |
| Workers | workers/**/*.test.ts | 流式处理、abort |
| Protocol | protocol/*.test.ts | 消息编解码 |
| Config | infra/config/*.test.ts | 配置加载 |

### 目录结构

```
src/
├── runtime/
│   ├── state-machine/
│   │   ├── conversation-machine.test.ts    # 状态机转换
│   │   └── context.test.ts                 # Context 验证
│   ├── voice-session/
│   │   ├── voice-session.test.ts           # 会话生命周期
│   │   ├── interrupt-handler.test.ts      # 打断逻辑
│   │   └── session-manager.test.ts         # 会话管理
│   ├── playback/
│   │   ├── playback-queue.test.ts         # 队列操作
│   │   └── underrun.test.ts               # underrun 检测
│   └── diagnostics/
│       └── diagnostics-collector.test.ts   # 指标收集
├── workers/
│   ├── asr/
│   │   └── qwen-asr.worker.test.ts         # ASR Worker
│   ├── llm/
│   │   └── qwen-llm.worker.test.ts         # LLM Worker
│   └── tts/
│       └── qwen-tts.worker.test.ts         # TTS Worker
├── gateway/
│   └── protocol/
│       └── codec.test.ts                   # 消息编解码
└── infra/
    └── config/
        └── config.test.ts                   # 配置加载
```

## 测试命令

```bash
# 运行所有测试 (单次)
npm run test:run

# Watch 模式
npm run test

# 类型检查
npx tsc --noEmit

# 代码规范
npm run lint

# 全部检查
npm run check
```

## 测试示例

### 1. State Machine 测试

```typescript
import { createActor } from 'xstate'
import { conversationMachine } from './conversation-machine'

describe('conversationMachine', () => {
  it('should transition to listening on START', () => {
    const actor = createActor(conversationMachine)
    actor.start()
    actor.send({ type: 'START' })
    expect(actor.getSnapshot().value).toBe('listening')
  })

  it('should transition through full pipeline', () => {
    const actor = createActor(conversationMachine)
    actor.start()
    actor.send({ type: 'START' })           // idle → listening
    actor.send({ type: 'VAD_END' })          // listening → transcribing
    actor.send({ type: 'ASR_COMPLETE', text: 'hello' }) // transcribing → thinking
    actor.send({ type: 'LLM_COMPLETE' })     // thinking → speaking
    actor.send({ type: 'SPEAK_COMPLETE' })   // speaking → idle
    expect(actor.getSnapshot().value).toBe('idle')
  })

  it('should go to interrupting from any state', () => {
    const states = ['listening', 'transcribing', 'thinking', 'speaking']
    for (const state of states) {
      const actor = createActor(conversationMachine)
      actor.start()
      // 到达目标状态
      transitionTo(actor, state)
      // 打断
      actor.send({ type: 'INTERRUPT' })
      expect(actor.getSnapshot().value).toBe('interrupting')
    }
  })
})
```

### 2. PlaybackQueue 测试

```typescript
import { PlaybackQueue } from './playback-queue'

describe('PlaybackQueue', () => {
  it('should enqueue and drain in order', () => {
    const queue = new PlaybackQueue()
    queue.enqueue(Buffer.from('a'))
    queue.enqueue(Buffer.from('b'))
    queue.enqueue(Buffer.from('c'))

    expect(queue.drain()?.toString()).toBe('a')
    expect(queue.drain()?.toString()).toBe('b')
    expect(queue.drain()?.toString()).toBe('c')
    expect(queue.isEmpty()).toBe(true)
  })

  it('should clear all items', () => {
    const queue = new PlaybackQueue()
    queue.enqueue(Buffer.from('a'))
    queue.enqueue(Buffer.from('b'))
    queue.clear()
    expect(queue.isEmpty()).toBe(true)
    expect(queue.drain()).toBeNull()
  })

  it('should detect underrun', () => {
    const queue = new PlaybackQueue()
    queue.drain()
    expect(queue.getUnderrunCount()).toBe(1)
  })

  it('should survive interrupt during drain', () => {
    const queue = new PlaybackQueue()
    queue.enqueue(Buffer.from('a'))
    queue.enqueue(Buffer.from('b'))
    const first = queue.drain()
    queue.clear() // interrupt
    const second = queue.drain()
    expect(first?.toString()).toBe('a')
    expect(second).toBeNull()
  })
})
```

### 3. VoiceSession 测试

```typescript
import { VoiceSession } from './voice-session'
import { MockWebSocket } from '../test/mocks'

describe('VoiceSession', () => {
  it('should handle audio chunk in listening state', async () => {
    const ws = new MockWebSocket()
    const session = new VoiceSession(ws)

    session.transitionTo('listening')
    session.handleAudioChunk(Buffer.from([1, 2, 3]))

    expect(session.getAudioBuffer().length).toBe(1)
  })

  it('should abort all on interrupt', async () => {
    const ws = new MockWebSocket()
    const session = new VoiceSession(ws)
    const abortSpy = vi.fn()

    session.transitionTo('thinking')
    session.registerAbortController('llm', { abort: abortSpy })
    session.handleInterrupt()

    expect(abortSpy).toHaveBeenCalled()
    expect(session.getState()).toBe('idle')
  })

  it('should clear audio buffer on interrupt', async () => {
    const ws = new MockWebSocket()
    const session = new VoiceSession(ws)

    session.transitionTo('listening')
    session.handleAudioChunk(Buffer.from([1, 2, 3]))
    session.handleInterrupt()

    expect(session.getAudioBuffer().length).toBe(0)
  })

  it('should recover from worker error', async () => {
    const ws = new MockWebSocket()
    const session = new VoiceSession(ws)

    session.transitionTo('transcribing')
    session.handleError('asr', new Error('connection failed'))
    expect(session.getState()).toBe('recovering')

    await session.recover()
    expect(session.getState()).toBe('idle')
  })
})
```

### 4. Worker 测试 (Mock)

```typescript
import { QwenAsrWorker } from './workers/asr/qwen-asr.worker'
import { Readable } from 'stream'

describe('QwenAsrWorker', () => {
  it('should stream transcript', async () => {
    const worker = new QwenAsrWorker({ apiKey: 'test' })
    const chunks: string[] = []

    const audioStream = Readable.from([Buffer.from('audio-data')])
    const signal = new AbortController().signal

    for await (const result of worker.stream(audioStream, signal)) {
      chunks.push(result.text)
    }

    expect(chunks.length).toBeGreaterThan(0)
  })

  it('should abort on signal', async () => {
    const worker = new QwenAsrWorker({ apiKey: 'test' })
    const signal = new AbortController().signal
    signal.abort()

    await expect(
      worker.stream(Readable.from([]), signal).next()
    ).rejects.toThrow('abort')
  })
})
```

### 5. Protocol 测试

```typescript
import { encodeMessage, decodeMessage } from './protocol/codec'

describe('Protocol Codec', () => {
  it('should encode/decode state.update', () => {
    const msg = { type: 'state.update', state: 'listening', turnId: 't1' }
    const encoded = encodeMessage(msg)
    const decoded = decodeMessage(encoded)
    expect(decoded).toEqual(msg)
  })

  it('should handle binary audio frame', () => {
    const audio = Buffer.from([1, 2, 3, 4])
    const encoded = encodeMessage({ type: 'audio', data: audio })
    const decoded = decodeMessage(encoded)
    expect(decoded.type).toBe('audio')
    expect(Buffer.from(decoded.data as ArrayBuffer)).toEqual(audio)
  })

  it('should reject oversized message', () => {
    const msg = { type: 'test', data: 'x'.repeat(5000) }
    expect(() => encodeMessage(msg)).toThrow('Message too large')
  })
})
```

## Mock 策略

### AI Worker Mocks (保留用于测试)

真实 AI Workers 已接入 DashScope API，Mock Workers 保留用于隔离测试：

```typescript
// Workers 实现
├── asr/
│   ├── qwen-asr.worker.ts    // 真实 Paraformer WebSocket
│   └── mock-asr.worker.ts    // 测试用 mock
├── llm/
│   ├── qwen-llm.worker.ts    // 真实 Qwen HTTP SSE
│   └── mock-llm.worker.ts    // 测试用 mock
└── tts/
    ├── qwen-tts.worker.ts    // 真实 CosyVoice WebSocket
    └── mock-tts.worker.ts    // 测试用 mock
```

生产环境使用 `QwenAsrWorker` / `QwenLlmWorker` / `QwenTtsWorker`
测试环境可注入 `MockAsrWorker` / `MockLlmWorker` / `MockTtsWorker` 以隔离外部 API 依赖。

### WebSocket Mock

```typescript
// src/test/mocks/websocket.ts
class MockWebSocket {
  readyState = WebSocket.OPEN
  sentMessages: any[] = []

  send(data: any) { this.sentMessages.push(data) }
  close() { this.readyState = WebSocket.CLOSED }
}
```

## 集成测试

### WebSocket E2E

使用 `ws` 库测试完整连接：

```typescript
import WebSocket from 'ws'
import { startServer } from '../../app'

describe('WebSocket E2E', () => {
  let server: ReturnType<typeof startServer>
  let client: WebSocket

  beforeAll(async () => {
    server = await startServer({ port: 3001 })
  })

  afterAll(() => server.close())

  beforeEach(() => {
    client = new WebSocket('ws://localhost:3001')
  })

  afterEach(() => client.close())

  it('should establish session', (done) => {
    client.on('open', () => {
      client.send(JSON.stringify({ type: 'session.init' }))
    })
    client.on('message', (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'session.established') {
        expect(msg.sessionId).toBeDefined()
        done()
      }
    })
  })
})
```

## 测试原则

### 1. 测试行为，不测试实现

```typescript
// ✅ Good
it('should transition to listening on START')

// ❌ Bad
it('should call assign() with turnId')
```

### 2. 每个测试一个断言

```typescript
// ✅ Good
it('should enqueue item', () => expect(queue.size()).toBe(1))
it('should drain in FIFO order', () => expect(queue.drain()).toEqual(first))
```

### 3. 保持测试独立

每个测试独立运行，不依赖其他测试。

### 4. Mock 外部依赖

- AI API 调用使用 Mock Workers
- WebSocket 使用 MockWebSocket
- 不依赖真实网络

## CI 集成

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm run test:run
```

## 覆盖率目标

| 模块 | 覆盖率目标 |
|------|-----------|
| State Machine | 100% |
| PlaybackQueue | 100% |
| Diagnostics | 90% |
| VoiceSession | 80% |
| Protocol | 100% |
| Workers | 70% |

## 未来计划

- [ ] E2E 测试 (多会话并发)
- [ ] 混沌测试 (网络延迟、断开)
- [ ] 性能基准测试
- [ ] Mock 服务真实验证
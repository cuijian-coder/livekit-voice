# Testing Strategy

## 概述

测试策略强调"可验证性 + 可维护性"，使用 Vitest 单元测试覆盖核心逻辑。

## 测试金字塔

```
           ┌─────────────────────────────────────┐
           │  Integration Tests (Real Backend)   │  ← Playwright + 真实 API
           ├─────────────────────────────────────┤
           │     E2E Tests (Mock Backend)        │  ← Playwright
           ├─────────────────────────────────────┤
           │         Unit Tests                  │  ← Vitest
           ├─────────────────────────────────────┤
           │          Lint + TypeCheck           │  ← CI
           └─────────────────────────────────────┘
```

## 测试框架

- **Vitest** - 单元测试框架 (Vite 原生集成)
- **TypeScript** - 类型检查
- **ESLint** - 代码规范

## 测试覆盖

### 当前覆盖 (Frontend)

| 模块 | 测试文件 | 测试数 | 状态 |
|------|----------|--------|------|
| Logger | buffer.test.ts, logger.test.ts | 15 | ✅ |
| Diagnostics | invariant.test.ts, validation.test.ts, timeline.test.ts | 38 | ✅ |
| Streaming | streaming.test.ts | 6 | ✅ |
| SpeechDetector | speech-detector.test.ts | 17 | ✅ |
| Voice Machine | voice-context.test.ts, voice-events.test.ts, voice-machine.test.ts | 54 | ✅ |
| Selectors | actionButton.selector.test.ts, voiceStatus.selector.test.ts, capability.selector.test.ts, animation.selector.test.ts | 40 | ✅ |
| Utils | id.test.ts, time.test.ts | 16 | ✅ |
| InputBar | InputBar.test.ts | 7 | ✅ |
| PCM Pipeline | pcm-pipeline.test.ts | 6 | ✅ |
| Binary Transport | binary-transport.test.ts | 5 | ✅ |
| **前端总计** | **20 个文件** | **204** | **100% 通过** |

### 当前覆盖 (Backend)

| 模块 | 测试文件 | 测试数 | 状态 |
|------|----------|--------|------|
| 各模块 | 4 个测试文件 | 41 | ✅ |

### E2E / 集成测试

| 类型 | 数量 | 说明 |
|------|------|------|
| Mock E2E | 27 | Playwright + Mock WebSocket 服务器 |
| Integration | 1 | Playwright + 真实后端 (ASR+LLM+TTS) |

### 目录结构 (Frontend)

```
src/app/
├── core/
│   ├── logger/
│   │   ├── buffer.test.ts       # 5 tests
│   │   └── logger.test.ts        # 10 tests
│   └── diagnostics/
│       ├── invariant.test.ts     # 6 tests
│       ├── validation.test.ts    # 22 tests
│       └── timeline.test.ts      # 10 tests
├── runtime/audio/
│   ├── speech-detector.test.ts   # 17 tests
│   └── pcm-pipeline.test.ts      # 6 tests (新增)
├── runtime/transport/
│   └── binary-transport.test.ts  # 5 tests (新增)
├── voice/
│   ├── machine/
│   │   ├── voice-context.test.ts
│   │   ├── voice-events.test.ts
│   │   └── voice-machine.test.ts  # 26 tests
│   └── selectors/
│       ├── actionButton.selector.test.ts   # 10 tests
│       ├── voiceStatus.selector.test.ts    # 6 tests
│       ├── capability.selector.test.ts     # 17 tests
│       └── animation.selector.test.ts      # 6 tests
├── services/
│   └── streaming.test.ts        # 6 tests
├── components/
│   └── InputBar.test.ts           # 7 tests (新增)
└── utils/
    ├── id.test.ts               # 6 tests
    └── time.test.ts             # 10 tests
```

## 测试命令

```bash
# 运行所有测试 (单次)
pnpm test:run

# Watch 模式
pnpm test

# 类型检查
pnpm typecheck

# 代码规范
pnpm lint
```

## 新增测试场景

### SpeechDetector 测试

```typescript
describe('SpeechDetector', () => {
  it('should transition to SPEAKING when energy exceeds threshold', () => {
    const detector = new SpeechDetector()
    const speechData = createSpeechData(128)
    const result = detector.onFrame(speechData)
    expect(result).toBe('SPEAKING')
  })

  it('should transition to POSSIBLE_END after silence timeout', () => {
    vi.useFakeTimers()
    const detector = new SpeechDetector({
      silenceTimeoutMs: 100,
      minSpeechDurationMs: 50,
    })
    // ... test silence timeout
    vi.useRealTimers()
  })

  it('should transition to INTERRUPTING when user speaks during assistant', () => {
    const detector = new SpeechDetector()
    detector.setAssistantSpeaking(true)
    const speechData = createSpeechData(128)
    const result = detector.onFrame(speechData)
    expect(result).toBe('INTERRUPTING')
  })
})
```

### Voice Machine 连续对话测试

```typescript
describe('continuous conversation flow', () => {
  it('should go listening -> thinking -> speaking -> listening', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    expect(actor.getSnapshot().value).toBe('thinking')

    actor.send({ type: 'llm.complete', fullText: 'response' })
    expect(actor.getSnapshot().value).toBe('speaking')

    actor.send({ type: 'tts.complete' })
    expect(actor.getSnapshot().value).toBe('listening')  // 不再是 idle
  })

  it('should allow multiple conversation cycles', () => {
    // ... 测试多轮对话
  })
})

describe('INTERRUPTING event', () => {
  it('should transition to listening on INTERRUPTING from speaking', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'llm.complete', fullText: 'response' })
    expect(actor.getSnapshot().value).toBe('speaking')

    actor.send({ type: 'INTERRUPTING' })
    expect(actor.getSnapshot().value).toBe('listening')
    expect(actor.getSnapshot().context.streamBuffer).toBe('')  // reset
  })
})
```

## CI 集成

### GitHub Actions (示例)

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
      - run: pnpm ci
      - run: pnpm --filter frontend run typecheck
      - run: pnpm --filter frontend run lint
      - run: pnpm --filter frontend run test:run
      - run: pnpm --filter backend run test:run
```

## 测试原则

### 1. 测试行为，不测试实现

```typescript
// ✅ Good - 测试行为
it('should transition to listening on session.start')

// ❌ Bad - 测试实现细节
it('should call assign() with requestId')
```

### 2. 每个测试一个断言

```typescript
// ✅ Good
it('should return record button', () => {
  expect(result.semantic).toBe('record');
});

it('should not be disabled', () => {
  expect(result.disabled).toBe(false);
});
```

### 3. 使用 describe 块组织

```typescript
describe('ModuleName', () => {
  describe('methodName', () => {
    it('should ...', () => { ... });
  });
});
```

### 4. 保持测试独立

每个测试应该独立运行，不依赖其他测试的状态。

## 未来计划

- [x] 集成测试 (Playwright + 真实后端 API)
- [x] E2E 测试 (Playwright + Mock WebSocket)
- [x] UI 组件测试 (InputBar)
- [ ] Mock Providers (用于无网络测试)
- [ ] 覆盖率报告
- [ ] 更多集成场景 (打断、多 turn、网络闪断)
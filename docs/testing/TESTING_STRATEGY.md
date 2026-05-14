# Testing Strategy

## 概述

测试策略强调"可验证性 + 可维护性"，使用 Vitest 单元测试覆盖核心逻辑。

## 测试金字塔

```
         ┌─────────────────────────────────────┐
         │     E2E Tests (Browser Manual)      │  ← 手动测试
         ├─────────────────────────────────────┤
         │       Integration Tests             │  ← XState Actor
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

### 当前覆盖

| 模块 | 测试文件 | 测试数 | 状态 |
|------|----------|--------|------|
| Logger | buffer.test.ts, logger.test.ts | 15 | ✅ |
| Diagnostics | invariant.test.ts, validation.test.ts, timeline.test.ts | 38 | ✅ |
| Streaming | streaming.test.ts | 6 | ✅ |
| Voice Machine | voice-context.test.ts, voice-events.test.ts, voice-machine.test.ts | 41 | ✅ |
| Selectors | actionButton.selector.test.ts, voiceStatus.selector.test.ts, capability.selector.test.ts, animation.selector.test.ts | 40 | ✅ |
| Utils | id.test.ts, time.test.ts | 20 | ✅ |
| **总计** | **15 个文件** | **160** | **100% 通过** |

### 目录结构

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
├── voice/
│   └── selectors/
│       ├── actionButton.selector.test.ts   # 10 tests
│       ├── voiceStatus.selector.test.ts    # 6 tests
│       ├── capability.selector.test.ts     # 17 tests
│       └── animation.selector.test.ts      # 6 tests
├── services/
│   └── streaming.test.ts        # 6 tests
└── utils/
    ├── id.test.ts               # 6 tests
    └── time.test.ts             # 14 tests
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
```

## 测试示例

### 1. Logger 测试

```typescript
describe('Logger', () => {
  it('should add log entry with correct level', () => {
    logger.info('test.event', { foo: 'bar' });
    const logs = logger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('info');
    expect(logs[0].event).toBe('test.event');
  });
});
```

### 2. State Machine 测试

```typescript
describe('voiceMachine', () => {
  it('should transition to listening on START_RECORDING', () => {
    actor.send({ type: 'START_RECORDING' });
    expect(actor.getSnapshot().value).toBe('listening');
  });

  it('should transition to thinking on STOP_RECORDING', () => {
    actor.send({ type: 'START_RECORDING' });
    actor.send({ type: 'STOP_RECORDING' });
    expect(actor.getSnapshot().value).toBe('thinking');
  });
});
```

### 3. Selector 测试

```typescript
describe('selectActionButton', () => {
  it('should return record button in idle state', () => {
    const snapshot = createSnapshot('idle');
    const result = selectActionButton(snapshot, false);
    expect(result.semantic).toBe('record');
  });

  it('should return stop-recording in listening state', () => {
    const snapshot = createSnapshot('listening');
    const result = selectActionButton(snapshot, false);
    expect(result.semantic).toBe('stop-recording');
  });
});
```

### 4. Validation 测试

```typescript
describe('validateVoiceState', () => {
  it('should pass for idle state', () => {
    const snapshot = createSnapshot('idle', { requestId: 'req-123' });
    const result = validateVoiceState(snapshot as any);
    expect(result.valid).toBe(true);
  });

  it('should fail when requestId is missing', () => {
    const snapshot = createSnapshot('idle', { requestId: '' });
    const result = validateVoiceState(snapshot as any);
    expect(result.valid).toBe(false);
  });
});
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
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm run test:run
```

## 测试原则

### 1. 测试行为，不测试实现

```typescript
// ✅ Good - 测试行为
it('should transition to listening on START_RECORDING')

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

- [ ] 集成测试 (voiceActor 完整流程)
- [ ] E2E 测试 (Playwright)
- [ ] Mock Providers (用于无网络测试)
- [ ] 覆盖率报告
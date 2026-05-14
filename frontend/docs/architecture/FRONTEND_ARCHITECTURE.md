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
// states: idle → listening → thinking → streaming → playing
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
    idle: {
      on: {
        START_RECORDING: 'listening',
        SUBMIT_TEXT: 'thinking',
      },
    },
    listening: { ... },
    thinking: { ... },
    streaming: { ... },
    playing: { ... },
    error: { ... },
  },
});
```

### 2. Voice Actor

职责：XState Actor 实例管理

```typescript
// voice-provider.ts
export const voiceActor = createActor(voiceMachine);

voiceActor.subscribe((snapshot) => {
  // 状态变化时更新 UI
  validateVoiceState(snapshot);
  timeline.add('state', { state: snapshot.value });
});

voiceActor.start();
```

### 3. Selectors (派生状态)

职责：从 XState snapshot 派生 UI 状态

```typescript
// actionButton.selector.ts
export function selectActionButton(
  snapshot: any,
  hasInput: boolean
): ButtonViewModel {
  const state = snapshot.value as string;

  if (state === 'listening') {
    return { semantic: 'stop-recording', ... };
  }
  if (state === 'thinking' || state === 'streaming') {
    return { semantic: 'interrupt', ... };
  }
  return { semantic: 'record', ... };
}
```

### 4. Logger (日志系统)

职责：结构化日志 + 内存缓冲

```typescript
// core/logger/logger.ts
export class Logger {
  private buffer = new LogBuffer();

  debug(event: string, data?: unknown) { ... }
  info(event: string, data?: unknown) { ... }
  warn(event: string, data?: unknown) { ... }
  error(event: string, data?: unknown) { ... }

  getLogs() { return this.buffer.getAll(); }
}
```

### 5. Diagnostics (运行时诊断)

职责：状态验证 + 转换验证

```typescript
// core/diagnostics/validation.ts
export function validateVoiceState(snapshot: any): ValidationResult {
  const state = snapshot.value as string;
  const ctx = snapshot.context;

  // 检查必要条件
  invariant(!!ctx.requestId, 'requestId required');
  if (state === 'streaming') {
    invariant(!!ctx.streamBuffer, 'streamBuffer required');
  }
}
```

## 数据流

```
User Action (Click)
       │
       ▼
InputBar.handleButtonClick()
       │
       ▼
voiceActor.send({ type: 'START_RECORDING' })
       │
       ▼
XState Machine Transition
       │
       ▼
voiceActor.subscribe() callback
       │
       ├─▶ validateVoiceState()  // 验证状态合法性
       ├─▶ timeline.add()        // 记录事件时间线
       ├─▶ logger.debug()        // 输出日志
       └─▶ InputBar.updateButton()  // 更新 UI
```

## 事件流

| 事件 | 来源 | 状态转换 | 处理 |
|------|------|----------|------|
| START_RECORDING | 用户点击 | idle → listening | 初始化录音 |
| STOP_RECORDING | 用户点击 | listening → thinking | 开始 ASR |
| INTERRUPT | 用户点击 | * → idle | 清理资源 |
| SUBMIT_TEXT | 用户提交 | idle → thinking | 发送文本 |
| LLM_DONE | LLM 完成 | thinking → streaming | 接收响应 |
| LLM_CHUNK | LLM 流式 | - | 更新 buffer |
| TTS_FINISHED | TTS 完成 | playing → idle | 结束 |

## 测试策略

### 单元测试

| 模块 | 测试文件 | 覆盖 |
|------|----------|------|
| Logger | logger.test.ts, buffer.test.ts | ✅ |
| Diagnostics | invariant.test.ts, validation.test.ts, timeline.test.ts | ✅ |
| Voice Machine | voice-machine.test.ts | ✅ |
| Selectors | actionButton.selector.test.ts, etc. | ✅ |
| Utils | time.test.ts, id.test.ts | ✅ |

### 运行测试

```bash
npm run test        # watch 模式
npm run test:run    # 单次运行
```

当前：160 个测试，100% 通过

## 浏览器兼容性

| 特性 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| XState v5 | ✅ 80+ | ✅ 80+ | ✅ 15+ | ✅ 80+ |
| DOM API | ✅ | ✅ | ✅ | ✅ |
| Web Audio | ✅ | ✅ | ✅ | ✅ |

## 性能优化

1. **Selector 派生** - 只在需要时计算 UI 状态
2. **Logger 缓冲** - 内存缓冲，不阻塞主线程
3. **XState 优化** - 最小状态转换
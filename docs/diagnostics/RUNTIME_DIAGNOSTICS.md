# Runtime Diagnostics

## 概述

运行时诊断系统用于快速发现状态错误、调试 XState runtime、调试 streaming 生命周期、调试 interruption。

## 组件概览

| 组件 | 文件 | 职责 |
|------|------|------|
| Logger | core/logger/logger.ts | 结构化日志 + 内存缓冲 |
| LogBuffer | core/logger/buffer.ts | 最近 200 条日志缓冲 |
| Invariant | core/diagnostics/invariant.ts | DEV/PROD 断言 |
| Validation | core/diagnostics/validation.ts | 状态 + 转换验证 |
| Timeline | core/diagnostics/timeline.ts | 最近 100 个事件时间线 |

## Logger

### 用途

结构化日志记录，用于调试和监控。

### API

```typescript
import { getLogger } from '../../core/logger'

const logger = getLogger()

logger.debug(event: string, data?: unknown)  // 调试信息
logger.info(event: string, data?: unknown)   // 一般信息
logger.warn(event: string, data?: unknown)    // 警告
logger.error(event: string, data?: unknown)   // 错误
```

### 日志结构

```typescript
interface LogEvent {
  id: string           // 唯一 ID
  timestamp: number    // 时间戳
  level: 'debug' | 'info' | 'warn' | 'error'
  event: string        // 事件名称
  requestId?: string   // 请求 ID
  data?: unknown      // 附加数据
}
```

### 使用示例

```typescript
// 记录状态变化
logger.debug('voice.state', { state: 'listening', requestId: 'req-123' })

// 记录流式事件
logger.info('stream.started', { requestId: 'req-123' })
logger.debug('stream.chunk', { size: chunk.length })
logger.info('stream.completed')

// 记录中断
logger.warn('interrupt', { requestId: 'req-123', reason: 'user' })
```

## Invariant

### 用途

条件断言，用于检查非法状态。

### 行为

- **DEV 模式**: 抛出 Error，中断执行
- **PROD 模式**: 输出 console.warn，继续执行

### API

```typescript
import { invariant } from '../../core/diagnostics'

invariant(condition: boolean, message: string, context?: Record<string, unknown>)
```

### 使用示例

```typescript
// 检查必要条件
invariant(!!ctx.requestId, 'requestId is required', { state })

// 检查状态约束
if (state === 'streaming') {
  invariant(!!ctx.streamBuffer, 'streamBuffer required', { state })
}
```

## Validation

### 用途

验证 XState snapshot 的合法性。

### API

```typescript
import { validateVoiceState, validateTransition } from '../../core/diagnostics'

// 验证状态
const result = validateVoiceState(snapshot)
if (!result.valid) {
  logger.warn('voice.state.invalid', { errors: result.errors })
}

// 验证转换
const transition = validateTransition('idle', 'START_RECORDING', 'listening')
if (!transition.valid) {
  logger.warn('voice.transition.invalid', { reason: transition.reason })
}
```

### 验证规则

#### 状态验证

| 规则 | 条件 | 级别 |
|------|------|------|
| requestId 必填 | 所有状态 | error |
| streamBuffer 必填 | streaming, playing | error |
| abortController 必填 | thinking | error |
| abortController 应为空 | playing | warning |

#### 转换验证

```
idle → listening ✅
idle → thinking ✅
idle → streaming ❌
listening → thinking ✅
thinking → streaming ✅
streaming → playing ✅
playing → idle ✅
```

## Timeline

### 用途

记录最近 100 个运行时事件，用于调试和时间线分析。

### API

```typescript
import { timeline } from '../../core/diagnostics'

// 添加事件
timeline.add('transition', { from: 'idle', to: 'listening' })
timeline.add('state', { state: 'listening' })
timeline.add('stream', { chunkId: 5 })

// 获取最近 N 个事件
timeline.getRecent(20)

// 清空
timeline.clear()
```

### 事件结构

```typescript
interface TimelineEvent {
  id: string
  timestamp: number
  event: string
  state?: string
  data?: unknown
}
```

## 集成

### Voice Actor 集成

在 voice-provider.ts 中自动记录：

```typescript
voiceActor.subscribe((snapshot: any) => {
  const state = snapshot.value as string

  // 1. 验证状态
  const validation = validateVoiceState(snapshot)
  if (!validation.valid) {
    logger.warn('voice.state.invalid', { errors: validation.errors })
  }

  // 2. 记录时间线
  timeline.add('state', { state, requestId: snapshot.context.requestId })

  // 3. 输出日志
  logger.debug('voice.state', { state, requestId: snapshot.context.requestId })
})
```

## 日志级别控制

### 环境配置

```typescript
// 开发环境：TRACE 级别
// 生产环境：INFO 级别
```

### 运行时控制

可通过 URL 参数覆盖：

```
?debug=true   // 全部输出
?debug=1      // DEBUG + INFO
```

## 内存缓冲

- **Logger Buffer**: 最近 200 条日志
- **Timeline**: 最近 100 个事件

两者都是内存存储，刷新页面后清空。

## 未来计划

- [ ] Debug Panel (可视化调试面板)
- [ ] localStorage 持久化
- [ ] Remote Transport (Sentry/OpenTelemetry)
- [ ] Performance Metrics
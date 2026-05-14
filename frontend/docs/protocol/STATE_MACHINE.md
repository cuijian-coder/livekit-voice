# State Machine

## 概述

系统使用 XState v5 管理语音对话的完整生命周期。当前采用**线性状态机**架构。

## 状态定义

```typescript
type VoiceState = 'idle' | 'listening' | 'thinking' | 'streaming' | 'playing' | 'error';
```

| 状态 | 描述 | UI 显示 |
|------|------|--------|
| idle | 空闲，可开始 | 麦克风按钮 |
| listening | 正在录音 | 录音中动画 |
| thinking | 等待 AI 响应 | 思考中... |
| streaming | 流式响应中 | 生成中... |
| playing | 播放 TTS | 播放中... |
| error | 错误状态 | 错误提示 |

## 状态图

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
              ┌──────────┐                                │
              │   idle   │ ◀────────────────────────────────┐
              └────┬─────┘                                 │
                   │ START_RECORDING                      │
                   ▼                                      │
    ┌──────────────────────────────────────────────────┐ │
    │                                                  │ │
    ▼                                                  │ │
┌─────────────┐    STOP_RECORDING    ┌─────────────┐   │ │
│ listening   │ ────────────────────▶│ thinking    │───┼─┤
│ (录音中)    │                       │ (等待响应)   │   │ │
└─────────────┘                       └──────┬──────┘   │ │
                                             │          │ │
                                             │ LLM_DONE │ │
                                             ▼          │ │
                                    ┌─────────────┐     │ │
                                    │ streaming   │     │ │
                                    │ (流式输出)   │     │ │
                                    └──────┬──────┘     │ │
                                           │            │ │
                                           │ LLM_DONE   │ │
                                           ▼            │ │
                                    ┌─────────────┐     │ │
                                    │ playing     │     │ │
                                    │ (播放中)    │     │ │
                                    └──────┬──────┘     │ │
                                           │            │ │
                                           │ TTS_FINISHED │
                                           │ or INTERRUPT │
                                           ▼            │ │
                                    ┌─────────────┐     │ │
                                    │ idle        │─────┘ │
                                    └─────────────┘       │
                                           ▲               │
                                           │ INTERRUPT      │
                                           └───────────────┘
```

## 状态转换规则

| 当前状态 | 事件 | 下一状态 | 动作 |
|---------|------|----------|------|
| idle | START_RECORDING | listening | 创建 requestId |
| idle | SUBMIT_TEXT | thinking | 创建 abortController |
| listening | STOP_RECORDING | thinking | 创建 abortController |
| listening | INTERRUPT | idle | 清理资源 |
| thinking | LLM_DONE | streaming | 设置 streamBuffer |
| thinking | INTERRUPT | idle | 清理资源 |
| streaming | LLM_CHUNK | - | 更新 streamBuffer |
| streaming | LLM_DONE | playing | 设置 streamBuffer |
| streaming | INTERRUPT | idle | 清理资源 |
| playing | TTS_FINISHED | idle | 清理资源 |
| playing | INTERRUPT | idle | 清理资源 |
| error | START_RECORDING | idle | - |
| error | SUBMIT_TEXT | thinking | - |

## Context 结构

```typescript
interface VoiceContext {
  transcript: string;          // 完整转写文本
  partialTranscript: string;   // 当前转写片段
  streamBuffer: string;         // LLM 流式响应缓冲
  sessionId: string;           // 会话 ID
  requestId: string;           // 请求 ID
  abortController?: AbortController;  // 中断控制器
  error?: string;              // 错误信息
}
```

## 事件类型

### 用户事件

| 事件 | 描述 |
|------|------|
| START_RECORDING | 开始录音 |
| STOP_RECORDING | 停止录音 |
| INTERRUPT | 打断 |
| SUBMIT_TEXT | 提交文本 |

### 系统事件

| 事件 | 描述 |
|------|------|
| ASR_PARTIAL | ASR 部分结果 |
| ASR_FINAL | ASR 最终结果 |
| STREAM_STARTED | 流式开始 |
| LLM_CHUNK | LLM 流式片段 |
| LLM_DONE | LLM 完成 |
| TTS_STARTED | TTS 开始 |
| TTS_FINISHED | TTS 完成 |
| ERROR | 错误 |

## 打断机制

### 打断流程

```
Any State (listening/thinking/streaming/playing)
    │
    │ INTERRUPT (用户点击打断按钮)
    ▼
┌─────────────────────────────────┐
│ 1. Frontend:                    │
│    - voiceActor.send(INTERRUPT) │
│    - 清理 streamBuffer          │
│    - 重置 requestId             │
│    - 清理 abortController       │
│    - 清除 error                 │
├─────────────────────────────────┤
│ 2. State Transition:            │
│    - current → idle             │
└────────────┬────────────────────┘
             │
             ▼
           idle
```

### 中断控制器

使用 AbortController 管理异步操作：

```typescript
// thinking 状态
assign({ abortController: () => new AbortController() })

// INTERRUPT 时
assign({ abortController: () => undefined })

// 外部使用
if (context.abortController) {
  context.abortController.abort()
}
```

## 验证规则

### 状态验证

| 规则 | 状态 | 检查 |
|------|------|------|
| requestId 必填 | 所有状态 | ✅ |
| streamBuffer 必填 | streaming, playing | ✅ |
| abortController 必填 | thinking | ✅ |
| abortController 应为空 | playing | ⚠️ warning |

### 转换验证

| 转换 | 有效？ |
|------|--------|
| idle → listening | ✅ |
| idle → thinking | ✅ |
| idle → streaming | ❌ |
| listening → thinking | ✅ |
| listening → streaming | ❌ |
| thinking → streaming | ✅ |
| streaming → playing | ✅ |
| playing → thinking | ❌ |

## 调试建议

### 查看状态变化

浏览器 console 输出：

```
[voice.transition] { from: 'idle', to: 'listening' }
[voice.state] { state: 'listening', requestId: 'req-xxx' }
[voice.state.invalid] { state: 'listening', errors: [...] }  // 如果验证失败
```

### 验证状态

每个状态变化都会自动验证：

```typescript
voiceActor.subscribe((snapshot) => {
  const validation = validateVoiceState(snapshot);
  if (!validation.valid) {
    logger.warn('voice.state.invalid', { errors: validation.errors });
  }
});
```

### 时间线

查看最近 100 个事件：

```typescript
timeline.getRecent(20);
// 返回: [{ event: 'transition', timestamp: ..., data: {...} }, ...]
```
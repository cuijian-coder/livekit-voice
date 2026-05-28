# InputBar

## 功能描述

主输入控件，是语音助手界面的核心交互组件。集成了文本输入、语音录制、ASR实时转写、录音可视化等功能。

## 核心结构

```
InputBar
├── textarea (文本输入框)
│   └── data-testid="text-input"
└── actionButton (操作按钮)
    └── data-testid="push-to-talk"
```

## 核心属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `textarea` | HTMLTextAreaElement | 文本输入框 |
| `actionButton` | HTMLButtonElement | 操作按钮（麦克风/发送/停止等） |
| `isProcessing` | boolean | 是否正在处理消息 |

## 核心方法

| 方法 | 描述 |
|------|------|
| `getElement()` | 返回组件根元素 |
| `handleButtonClick()` | 处理按钮点击，根据当前状态执行对应操作 |
| `sendMessage()` | 发送文本消息到聊天窗口和语音机 |

## 按钮状态与行为

按钮根据语音状态机状态和输入内容显示不同样式：

| 状态 | 按钮样式 | 点击行为 |
|------|----------|----------|
| `idle` (无输入) | 麦克风图标 | 发送 `session.start` 开始录音 |
| `idle` (有输入) | 发送图标 | 调用 `sendMessage()` |
| `listening` | 停止图标 | 发送 `audio.commit.manual` 提交录音 |
| `transcribing` | loading 图标 | 发送 `interrupt.request` 打断 |
| `thinking` | loading 图标 | 发送 `interrupt.request` 打断 |
| `speaking` | 停止图标 | 发送 `interrupt.request` 打断 |

## ASR 转写显示

组件订阅 `voiceActor` 状态变化，当收到 `asr.partial` 或 `asr.final` 事件时：

1. **listening/transcribing/thinking 状态**：显示 `partialTranscript`（实时部分结果）
2. **listening/idle 状态**：显示最终 `transcript`

**注意**：listening 状态也会显示实时 ASR 文字，用户可以在录音过程中看到识别结果。录音期间 `partialTranscript` 优先于 `transcript`；停止录音后若 `asr.final` 为空但 `partialTranscript` 有内容，后端会降级使用 partial 继续 LLM 流程，前端不会显示 "未识别文字"。

## 录音可视化

在 `listening` 状态时，根据音量级别动态调整声波图标：

- **level = 0**：显示 4 个水平点（无声）
- **level > 0**：正弦波动画，4 个点相位偏移产生波浪效果

音频回调仅在**首次进入 listening 状态时设置一次**，避免每次 snapshot 更新都重复注册，减少不必要的 console 噪音。

## 事件绑定

```typescript
// 文本输入
textarea.addEventListener('input', handleInput)

// Enter 键发送
textarea.addEventListener('keydown', handleKeydown)

// 按钮点击
actionButton.addEventListener('click', handleButtonClick)

// 语音状态变化
voiceActor.subscribe(onStateChange)
```

## 使用场景

- 用户输入文本消息
- 用户点击按钮开始/停止语音录制
- 实时显示 ASR 识别结果
- 显示最终转写文本
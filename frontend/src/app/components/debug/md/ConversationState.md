# ConversationState

## 功能描述

语音对话状态机当前状态显示组件。

## 状态值

| 状态 | 显示文本 | 含义 |
|------|----------|------|
| `idle` | "idle" | 空闲状态 |
| `listening` | "listening" | 聆听中（录音） |
| `transcribing` | "transcribing" | 转写中 |
| `thinking` | "thinking" |思考中（LLM处理） |
| `speaking` | "speaking" | 说话中（TTS播放） |
| `error` | "error" | 错误状态 |

## 核心方法

| 方法 | 描述 |
|------|------|
| `setState(state: string)` | 更新显示状态 |

## 使用场景

- 监控语音对话流程
- 调试状态转换问题
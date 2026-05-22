# TtsStatus

## 功能描述

TTS (Text-to-Speech) 语音合成状态显示组件。

## 显示格式

根据 TTS 引擎返回的状态显示，例如：
- "tts: started"
- "tts: chunk"
- "tts: complete"

## 核心方法

| 方法 | 描述 |
|------|------|
| `setStatus(status: string)` | 更新 TTS 状态 |

## 使用场景

- 监控 TTS 语音合成进度
- 调试语音输出问题
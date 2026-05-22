# AudioState

## 功能描述

音频录制/播放状态显示组件。

## 状态值

| 状态 | 显示文本 | 含义 |
|------|----------|------|
| `idle` | "audio: -" | 无音频活动 |
| `listening` | "audio: ●" | 正在录音 |
| `transcribing` | "audio: ●" | 正在录音（转写中） |
| `speaking` | "audio: ◉" | 正在播放 TTS |

## 核心方法

| 方法 | 描述 |
|------|------|
| `setState(state: string)` | 更新显示状态 |

## 使用场景

- 监控音频活动状态
- 调试录音/播放问题
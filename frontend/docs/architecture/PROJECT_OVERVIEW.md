# Project Overview

## 项目名称

LiveKit Voice Chat UI

## 项目目标

构建 ChatGPT Voice / Gemini Live 风格的实时语音对话 UI 系统，支持**连续双工语音**交互。

## 核心能力

| 能力 | 描述 |
|------|------|
| Always-on Recording | 麦克风持续采集，VAD 不阻塞音频发送 |
| Silence Auto-commit | 600ms 静音自动触发 audio.commit |
| Streaming ASR | 语音识别实时返回 partial 结果 |
| Streaming TTS | 语音合成流式输出音频 |
| Continuous Conversation | TTS 结束后回到 listening，持续对话 |
| Barge-in / Interruption | 支持在 AI 说话时随时打断 |

## 当前阶段

**Phase 4: 连续双工语音系统** ✅ 已完成

- [x] Vite + TypeScript 项目初始化
- [x] XState v5 状态机 (连续对话)
- [x] SpeechDetector (VAD, 打断检测)
- [x] UtteranceManager (自动 commit)
- [x] BinaryTransport (二进制帧发送)
- [x] Streaming ASR 集成 (asr.partial)
- [x] TTS 流式播放 (playback.ts)
- [x] Barge-in / Interruption (打断检测 → 状态转换)
- [x] 运行时诊断系统 (Logger + Invariant + Validation)
- [x] 单元测试覆盖 (186 tests)

## 技术选型

### 前端

| 技术 | 用途 |
|------|------|
| Vite | 开发服务器 + 构建 |
| TypeScript | 类型安全 |
| XState v5 | 状态管理 |
| DOM API | UI 构建 (非 React) |
| Web Audio | 音频录制和播放 |

### 核心模块

| 组件 | 用途 |
|------|------|
| voiceMachine | 主状态机 (idle → listening ↔ thinking ↔ speaking) |
| speechDetector | VAD、能量检测、打断检测 |
| utteranceManager | Turn 生命周期、自动 commit |
| binaryTransport | 二进制音频帧发送 |
| voiceActor | XState Actor 实例 |
| selectors | 派生 UI 状态 |

### 诊断系统

| 组件 | 用途 |
|------|------|
| Logger | 结构化日志 + 内存缓冲 |
| Invariant | DEV/PROD 断言 |
| Validation | 状态 + 转换验证 |
| Timeline | 事件时间线 |

## 系统边界

### 包含

- 前端语音 UI
- XState 状态机
- SpeechDetector / UtteranceManager
- BinaryTransport
- 运行时诊断系统
- 单元测试

### 不包含

- 后端服务
- 用户认证
- 消息存储

## 非目标

| 非目标 | 原因 |
|--------|------|
| React/Vue | 使用 Vanilla TypeScript |
| Electron | 纯浏览器端 |
| WebRTC | 使用 LiveKit SDK |
| Push-to-talk | Always-on recording |

## 关键约束

1. **无框架**: 使用 Vanilla TypeScript + DOM API
2. **XState v5**: 使用最新版本 XState
3. **全双工**: 麦克风和 TTS 同时工作
4. **测试驱动**: 186+ 单元测试覆盖

## 连续对话流程

```
用户说话 → SpeechDetector → UtteranceManager → audio.start
    │
    ▼
600ms 静音 → SpeechDetector → UtteranceManager → audio.commit
    │
    ▼
Backend: ASR → LLM → TTS
    │
    ▼
TTS complete → speaking → listening (持续对话)
```

## 参考资料

- [XState v5](https://xstate.js.org/docs/)
- [Vite](https://vitejs.dev/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
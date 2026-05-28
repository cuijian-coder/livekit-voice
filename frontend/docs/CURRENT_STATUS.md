# Current Status

## 项目概述

LiveKit Voice Chat UI - 基于 Vite + Vanilla TypeScript + XState v5 的实时语音对话前端。实现了连续双工语音系统，支持全双工交互。

## 开发阶段

- **Phase 1: 基础设施** ✅ 已完成
- **Phase 2: 消息系统** ✅ 已完成
- **Phase 3: 后端集成** ✅ 已完成
- **Phase 4: 连续双工语音** ✅ 已完成

## 核心功能状态

| 功能 | 状态 | 说明 |
|------|------|------|
| Always-on Recording | ✅ | PCM 始终发送，VAD 仅控制 UI |
| SpeechDetector | ✅ | 能量检测，1500ms 静音不自动 commit |
| UtteranceManager | ✅ | Turn 生命周期管理，手动 commit |
| Streaming ASR | ✅ | 后端实时返回 asr.partial，100ms batch 发送 |
| Real-time ASR Display | ✅ | listening 状态实时显示 partial 文字 |
| Transcribing State | ✅ | 等待 ASR 结果，支持打断和超时 |
| Continuous Conversation | ✅ | speaking → listening → thinking → speaking |
| Barge-in / Interruption | ✅ | 用户可打断助手说话 |
| Duplex TTS Playback | ✅ | 流式播放，支持中断 |
| Empty ASR Fallback | ✅ | final 为空时降级使用 partial |
| Read Aloud | ✅ | 独立 AudioContext，消息级 TTS |

## Monorepo 结构

```
livekit-voice/
├── packages/shared/          # @livekit-voice/shared 共享包
├── frontend/                 # 前端应用
│   └── src/app/runtime/
│       ├── audio/            # SpeechDetector, UtteranceManager
│       ├── transport/        # BinaryTransport, WebSocket
│       └── constants.ts      # 音频配置
└── backend/                  # 后端服务
    └── src/runtime/          # VoiceSession, Streaming ASR
```

## 模块状态

### ✅ 已完成模块

| 模块 | 状态 | 说明 |
|------|------|------|
| 项目初始化 | 完成 | Vite + TypeScript + ESLint + pnpm workspace |
| XState 状态机 | 完成 | 连续对话状态机 (idle→listening↔thinking↔speaking) |
| SpeechDetector | 完成 | VAD、能量检测、打断检测 |
| UtteranceManager | 完成 | 自动 commit、Turn 管理 |
| BinaryTransport | 完成 | 二进制帧发送、flush、commit |
| Logger 系统 | 完成 | 结构化日志 + 内存缓冲 |
| Diagnostics | 完成 | Invariant + Validation + Timeline |
| 单元测试 | 完成 | 186 个测试，100% 通过 |
| 音频录制 | 完成 | AudioWorklet + PCM 始终发送 |
| TTS 播放 | 完成 | 流式播放，支持中断 |
| Read Aloud | 完成 | 独立播放，支持消息级朗读 |

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
TTS stream → playback.onChunk()
    │
    ▼
tts.complete → listening (麦克风继续，不中断)
    │
    ▼
用户继续说话 → 新的一轮对话
```

## 打断流程

```
speaking (TTS playing)
    │
    │ 用户说话 + isAssistantSpeaking = true
    ▼
SpeechDetector → INTERRUPTING
    │
    ▼
UtteranceManager.cancel()
    │
    ├─► binaryTransport.cancel()
    ├─► turn.cancel → Backend
    └─► onInterruptedCallback() → voiceActor.send(INTERRUPTING)
    │
    ▼
speaking → listening
```

## 事件名称

| 事件 | 描述 | 方向 |
|------|------|------|
| session.start | 开始会话 | WS 连接时自动 |
| audio.start | Turn 开始 | Frontend → Backend |
| audio.commit | Turn 结束 | Frontend → Backend |
| turn.cancel | 取消当前 Turn | Frontend → Backend |
| asr.partial | ASR 部分结果 | Backend → Frontend |
| asr.final | ASR 最终结果 | Backend → Frontend |
| llm.token | LLM 流式 token | Backend → Frontend |
| tts.chunk | TTS 音频块 | Backend → Frontend (binary) |
| INTERRUPTING | 检测到打断 | Internal → Voice Machine |

## 技术栈

- **构建工具**: Vite
- **包管理器**: pnpm workspace
- **语言**: TypeScript (Vanilla, 无框架)
- **状态管理**: XState v5
- **测试**: Vitest (186 tests)
- **样式**: CSS (无预处理器)
- **共享包**: @livekit-voice/shared

## 代码统计

- **前端单元测试**: 156
- **后端单元测试**: 41
- **Mock E2E 测试**: 27
- **集成测试**: 1 (真实后端 ASR+LLM+TTS)
- **测试覆盖率**: 核心模块全覆盖

## 下一步优先级

1. ✅ 连续双工语音系统已实现
2. ✅ ASR 实时显示已修复
3. ✅ 多 turn 稳定性已修复
4. ⏳ DashScope ASR 预连接优化（可选，减少 200-400ms 首包延迟）
5. ⏳ UI 优化（字幕显示、状态动画）
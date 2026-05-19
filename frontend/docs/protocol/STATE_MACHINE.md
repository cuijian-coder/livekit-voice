# State Machine

## 概述

系统使用 XState v5 管理语音对话的完整生命周期。采用**连续对话状态机**架构，支持全双工语音交互。

## 核心设计原则

1. **Always-on Recording**: 麦克风持续采集，VAD 不阻塞音频发送
2. **Silence Auto-commit**: 600ms 静音自动触发 audio.commit
3. **Continuous Conversation**: TTS 结束后回到 listening，不中断录音
4. **Full Duplex**: 支持用户和助手同时说话（打断/插话）

## 状态定义

```typescript
type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error';
```

| 状态 | 描述 | 麦克风 | TTS |
|------|------|--------|-----|
| idle | 空闲状态 | 关闭 | 关闭 |
| listening | 持续录音中 | 开启 | 关闭 |
| thinking | 等待助手响应 | 开启 | 关闭 |
| speaking | 助手正在说话 | 开启 | 播放中 |
| interrupted | 被用户打断 | 开启 | 停止 |
| error | 错误状态 | 关闭 | 关闭 |

## 状态图

```
                           用户说话或 asr.final
                          ─────────────────────────▶
┌──────────┐                                    ┌─────────────┐
│   idle   │◀───────────────────────────────────│   thinking  │
└────┬─────┘                                     └──────┬──────┘
     │ session.start                                   │
     │                                                │ llm.complete
     ▼                                                ▼
┌─────────────┐    600ms 静音     ┌─────────────┐    ┌─────────────┐
│ listening   │ ────────────────▶│  thinking   │───▶│  speaking   │
│ (麦克风开启) │    audio.commit   │ (等待响应)   │    │ (TTS 播放)  │
└──────┬──────┘                   └─────────────┘    └──────┬──────┘
       │                                                        │
       │                            tts.complete                │ 用户插话
       │◀───────────────────────────────────────────────────────┤ INTERRUPTING
       │                            回到 listening              │
       │                                                        ▼
       │                                              ┌─────────────────┐
       │                                              │   interrupted    │
       │                                              │  (resetSession)  │
       │                                              └────────┬────────┘
       │                                                       │
       │◀──────────────────────────────────────────────────────┘
       │                            回到 idle
```

## 关键状态转换

### 连续对话循环

```
listening → (600ms silence) → thinking → (llm.complete) → speaking → (tts.complete) → listening
```

### 打断/插话

```
speaking → (用户说话) → listening (麦克风不中断，TTS 停止)
```

## Context 结构

```typescript
interface VoiceContext {
  transcript: string;          // 完整转写文本
  partialTranscript: string;   // 当前转写片段
  streamBuffer: string;        // TTS 流式响应缓冲
  sessionId: string;           // 会话 ID
  turnId: string;              // 当前 turn ID
  requestId: string;           // 请求 ID
  abortController?: AbortController;
  error?: string;
}
```

## 事件类型

### 用户事件

| 事件 | 描述 | 来源 |
|------|------|------|
| session.start | 开始会话 | App.ts (WS 连接时) |
| audio.commit | 提交音频 | UtteranceManager (静音超时) |
| interrupt.request | 打断请求 | UI 按钮 |
| SUBMIT_TEXT | 提交文本 | 文本输入 |

### 系统事件

| 事件 | 描述 | 来源 |
|------|------|------|
| asr.partial | ASR 部分结果 | Backend |
| asr.final | ASR 最终结果 | Backend |
| llm.started | LLM 开始 | Backend |
| llm.token | LLM 流式 token | Backend |
| llm.complete | LLM 完成 | Backend |
| tts.started | TTS 开始 | Backend |
| tts.complete | TTS 完成 | Backend |
| INTERRUPTING | 检测到打断 | SpeechDetector |
| runtime.error | 运行时错误 | Backend |

## 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Voice Machine (XState)                  │
│                                                             │
│  States: idle | listening | thinking | speaking | ...      │
│  Manages: turn lifecycle, conversation flow                 │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │
┌─────────────────────────────────────────────────────────────┐
│                    UtteranceManager                         │
│                                                             │
│  Responsibilities:                                          │
│  - audio.start on speech start                              │
│  - audio.commit on silence timeout (600ms)                  │
│  - turn.cancel on interruption                              │
│  - seq reset per turn                                       │
│  - Integrates with SpeechDetector                           │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │
┌─────────────────────────────────────────────────────────────┐
│                    SpeechDetector                            │
│                                                             │
│  States: IDLE | SPEAKING | POSSIBLE_END | INTERRUPTING      │
│  - Energy detection (RMS)                                   │
│  - Silence timeout (600ms) → auto commit                    │
│  - Interruption detection (user speaking while assistant)   │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │
┌─────────────────────────────────────────────────────────────┐
│                    AudioRecorder                            │
│                                                             │
│  - AudioWorklet pcm-capture-processor.ts                    │
│  - PCM always streams (VAD only gates UI, not sending)      │
│  - onPcmData(seq, float32Data) → speechDetector.onFrame()   │
└─────────────────────────────────────────────────────────────┘
```

## 打断机制

### 打断流程

```
Assistant speaking (speaking state)
         │
         │ User speaks → SpeechDetector detects energy > threshold
         │              while isAssistantSpeaking = true
         ▼
SpeechDetector → INTERRUPTING
         │
         ▼
UtteranceManager.cancel()
         │
         ├─ binaryTransport.cancel()
         ├─ wsClient.send({ type: 'turn.cancel', turnId })
         └─ onInterruptedCallback() → voiceActor.send(INTERRUPTING)
         │
         ▼
Voice Machine: speaking → listening (resetSession)
         │
         ▼
Recording continues, new turn started
```

### Assistant Speaking Flag

SpeechDetector 知道助手是否在说话：

```typescript
// 进入 speaking 状态时
speechDetector.setAssistantSpeaking(true)

// 退出 speaking 状态时
speechDetector.setAssistantSpeaking(false)
```

## 验证规则

### 状态验证

| 规则 | 状态 | 检查 |
|------|------|------|
| requestId 必填 | 所有状态 | ✅ |
| turnId 必填 | listening, thinking, speaking | ✅ |
| abortController 必填 | thinking | ✅ |

### 转换验证

| 转换 | 有效？ |
|------|--------|
| idle → listening | ✅ |
| listening → thinking | ✅ |
| listening → listening (asr.partial) | ✅ |
| thinking → speaking | ✅ |
| thinking → listening (asr.final) | ✅ |
| speaking → listening (tts.complete) | ✅ |
| speaking → listening (INTERRUPTING) | ✅ |
| any → idle (interrupt.request) | ✅ |
| any → error (runtime.error) | ✅ |

## 调试建议

### 查看状态变化

```bash
# 后端日志
tail -f /tmp/server.log | grep -E "audio.start|audio.commit|asr.partial|asr.final"

# 前端 console
[voice.state] { state: 'listening', turnId: 'turn-xxx' }
[speechDetector.stateChange] { from: 'SPEAKING', to: 'INTERRUPTING' }
[utteranceManager.turn.start] { turnId: 'turn-xxx' }
```

### 强制静音超时测试

```javascript
// 在浏览器 console 中
// 将静音超时设置为 1 秒进行测试
window.AUDIO_CONFIG = { silenceTimeoutMs: 1000 }
```
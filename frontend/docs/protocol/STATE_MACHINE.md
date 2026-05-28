# State Machine

## 概述

系统使用 XState v5 管理语音对话的完整生命周期。采用**连续对话状态机**架构，支持全双工语音交互。

## 核心设计原则

1. **Always-on Recording**: 麦克风持续采集，VAD 不阻塞音频发送
2. **Manual Commit**: VAD 检测到 POSSIBLE_END 仅记录日志，不自动触发 audio.commit；只有用户手动点击停止按钮才提交录音
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
| transcribing | ASR 识别中（等待最终/部分结果） | 关闭 | 关闭 |
| thinking | 等待助手响应（LLM 推理中） | 关闭 | 关闭 |
| speaking | 助手正在说话 | 关闭 | 播放中 |
| interrupted | 被用户打断 | 开启 | 停止 |
| error | 错误状态 | 关闭 | 关闭 |

## 状态图

```
                            用户说话或 asr.final (有文字)
                           ─────────────────────────▶
┌──────────┐                                    ┌─────────────┐
│   idle   │◀───────────────────────────────────│   thinking  │
└────┬─────┘                                     └──────┬──────┘
     │ session.start                                   │
     │                                                │ llm.complete
     ▼                                                ▼
┌─────────────┐    手动停止      ┌─────────────┐    ┌─────────────┐
│ listening   │ ───────────────▶│ transcribing│───▶│  speaking   │
│ (麦克风开启) │  audio.commit    │ (ASR 处理)   │    │ (TTS 播放)  │
│  asr.partial │                 └─────────────┘    └──────┬──────┘
└──────┬──────┘                   ↑                      │
       │                          │ asr.partial (重置超时)│
       │                          │ asr.final 为空      │
       │                          │ + partial 有内容    │ 用户插话
       │◀── tts.complete ─────────┘ + partial 为空      │ INTERRUPTING
       │                            → idle (toast)     │
       │                                                 ▼
       │                                       ┌─────────────────┐
       │                                       │   interrupted    │
       │                                       │  (resetSession)  │
       │                                       └────────┬────────┘
       │                                                │
       │◀───────────────────────────────────────────────┘
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
  transcript: string;          // 完整转写文本 (asr.final)
  partialTranscript: string;   // 当前转写片段 (asr.partial)
  streamBuffer: string;        // TTS 流式响应缓冲
  sessionId: string;           // 会话 ID
  turnId: string;              // 当前 turn ID
  requestId: string;          // 请求 ID
  abortController?: AbortController;
  error?: string;
  toastMessage?: string;      // 空 ASR 提示消息
  hasAsrResult: boolean;      // 是否收到过 asr.partial
  lastAsrActivityAt?: number; // 最后一次 ASR 活动时间戳
  manualCommit: boolean;      // 是否由用户手动触发 commit
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
│  - audio.start on speech start (VAD SPEAKING)                 │
│  - audio.commit on manual button click (NOT auto)            │
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
│  - Silence timeout (1500ms) → logs only, does NOT commit    │
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

| 转换 | 有效？ | 说明 |
|------|--------|------|
| idle → listening | ✅ | session.start |
| idle → thinking | ✅ | SUBMIT_TEXT |
| listening → transcribing | ✅ | audio.commit / audio.commit.manual |
| listening → thinking | ✅ | SUBMIT_TEXT |
| listening → listening (asr.partial) | ✅ | 实时更新 partialTranscript |
| listening → idle (interrupt.request) | ✅ | 取消录音 |
| transcribing → transcribing (asr.partial) | ✅ | 重置 15s 超时 |
| transcribing → thinking | ✅ | asr.final 有文字 → 发 submit.text |
| transcribing → idle | ✅ | asr.final 为空 + partial 为空 → toast |
| thinking → speaking | ✅ | llm.complete |
| thinking → idle (asr.final 空) | ✅ | 降级：final 为空但 partial 有 → 用 partial 发 submit.text |
| speaking → listening | ✅ | tts.complete |
| speaking → idle (INTERRUPTING) | ✅ | 用户打断 |
| any → idle (interrupt.request) | ✅ | |
| any → error (runtime.error) | ✅ | |

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
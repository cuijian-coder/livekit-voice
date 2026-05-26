# LiveKit Voice Chat - 系统架构设计文档

> 实时语音对话系统 | Vite + Vanilla TypeScript + XState v5 | 全双工语音交互

---

## 1. 项目概述

### 1.1 项目目标

构建 ChatGPT Voice / Gemini Live 风格的**实时语音对话系统**，支持：
- 用户语音输入 → ASR 识别 → LLM 推理 → TTS 合成 → 语音输出
- 全双工交互（打断、插话）
- 连续多轮对话

### 1.2 核心能力

| 能力 | 描述 | 状态 |
|------|------|------|
| **实时 ASR** | 录音过程中实时显示识别文字 | ✅ |
| **手动提交** | 用户点击按钮提交录音（非自动） | ✅ |
| **流式 LLM** | Token 级实时响应 | ✅ |
| **流式 TTS** | 音频 chunk 实时播放 | ✅ |
| **打断/插话** | 用户可随时中断 AI 说话 | ✅ |
| **Read Aloud** | 消息级独立朗读 | ✅ |
| **多 Turn 对话** | 支持连续录音不冲突 | ✅ |
| **运行时诊断** | 完整日志 + 状态快照 | ✅ |

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层 (Browser)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Chat UI   │  │  InputBar   │  │    MessageList          │  │
│  │ (对话展示)   │  │ (录音按钮)   │  │    (消息列表)           │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │
│         │                │                                       │
│  ┌──────┴────────────────┴─────────────────────────────────┐   │
│  │                    Voice Actor (XState v5)                  │   │
│  │  States: idle → listening → transcribing → thinking →    │   │
│  │          speaking → idle                                   │   │
│  │  Context: transcript, partialTranscript, turnId, ...     │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                            │                                     │
│  ┌─────────────────────────┴─────────────────────────────────┐  │
│  │                    Runtime Layer                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │AudioRecorder │  │ SpeechDetector│  │ UtteranceManager│  │  │
│  │  │(AudioWorklet)│  │ (VAD/能量)   │  │ (Turn 生命周期) │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │  │
│  │         │                │                   │            │  │
│  │  ┌──────┴────────────────┴───────────────────┴────────┐   │  │
│  │  │              PCM Pipeline + Binary Transport         │   │  │
│  │  │  (VAD 过滤 → 预缓冲 → WebSocket 二进制发送)        │   │  │
│  │  └────────────────────────┬───────────────────────────┘   │  │
│  │                            │                                 │  │
│  │  ┌─────────────────────────┴─────────────────────────────┐ │  │
│  │  │              WebSocket Client + Message Router         │ │  │
│  │  │  (JSON 消息 + 二进制音频 双向传输)                      │ │  │
│  │  └────────────────────────┬──────────────────────────────┘ │  │
│  └───────────────────────────┼────────────────────────────────┘  │
│                              │                                    │
└──────────────────────────────┼────────────────────────────────────┘
                               │ WebSocket
┌──────────────────────────────┼────────────────────────────────────┐
│                              │                                    │
│  ┌───────────────────────────┴────────────────────────────────┐  │
│  │                    Backend (Node.js + Fastify)                 │  │
│  │                                                                │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  VoiceSession (XState Actor)                             │  │  │
│  │  │  States: idle → listening → transcribing → thinking →   │  │  │
│  │  │          speaking → idle                                  │  │  │
│  │  └────────────────────────┬─────────────────────────────────┘  │  │
│  │                         │                                      │  │
│  │  ┌──────────────┐  ┌────┴────────┐  ┌─────────────────┐     │  │
│  │  │ ASR Worker   │  │ LLM Worker   │  │ TTS Worker      │     │  │
│  │  │ (DashScope   │  │ (DashScope   │  │ (Aliyun NLS     │     │  │
│  │  │  fun-asr)    │  │  Qwen)       │  │  Streaming)     │     │  │
│  │  │ 100ms batch  │  │ 流式输出     │  │ 流式音频        │     │  │
│  │  └──────────────┘  └─────────────┘  └─────────────────┘     │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端构建** | Vite + TypeScript | 无框架，Vanilla DOM |
| **状态管理** | XState v5 | Actor 模型，声明式状态机 |
| **音频采集** | Web Audio API + AudioWorklet | 16kHz PCM 16-bit |
| **网络传输** | WebSocket | JSON 消息 + 二进制音频 |
| **后端框架** | Fastify + pino | 高性能 Node.js 框架 |
| **AI 服务** | DashScope (ASR/LLM) | 阿里云大模型平台 |
| **TTS 服务** | Aliyun NLS | 阿里云语音合成 |

---

## 3. 核心模块设计

### 3.1 前端状态机 (Voice Machine)

```typescript
type VoiceState = 
  | 'idle'           // 空闲
  | 'listening'      // 录音中（麦克风开启）
  | 'transcribing'   // ASR 识别中（等待最终结果）
  | 'thinking'       // LLM 推理中
  | 'speaking'       // TTS 播放中
  | 'error'          // 错误状态
```

**关键设计**：
- **手动提交**：VAD 检测到 `POSSIBLE_END` 不自动提交，只有用户点击按钮才触发 `audio.commit.manual`
- **降级策略**：`asr.final` 为空但 `partialTranscript` 有内容时，使用 partial 继续 LLM 流程
- **状态保护**：`transcribing` 状态可点击打断，避免长时间等待 ASR

### 3.2 音频流水线

```
AudioWorklet (128 samples/frame @ 16kHz)
    ↓
Float32Array (8ms/frame)
    ↓
SpeechDetector (VAD 能量检测)
    ↓
[SPEAKING] → PCM Pipeline (预缓冲 25 frames ≈ 500ms)
    ↓
BinaryTransport (WebSocket binary frames)
    ↓
Backend VoiceSession
```

**VAD 配置**：
- `silenceTimeoutMs: 1500` - 静音判定阈值
- `minSpeechDurationMs: 500` - 最小语音时长
- `micEnergyThreshold: 0.01` - 能量阈值

### 3.3 ASR Batch 发送策略

前端每 8ms 推一帧（256 bytes），后端累积到 **3200 bytes（100ms @ 16kHz）** 后一次性发送：

```typescript
let batchBuffer = Buffer.alloc(0)
for await (const chunk of audioStream) {
  batchBuffer = Buffer.concat([batchBuffer, chunk])
  while (batchBuffer.length >= 3200) {
    ws.send(batchBuffer.subarray(0, 3200))
    batchBuffer = batchBuffer.subarray(3200)
  }
}
// flush 剩余音频
if (batchBuffer.length > 0) ws.send(batchBuffer)
```

**优势**：
- 消除旧版 50ms 节流导致的队列积压（从 7000+ 帧降至稳定 0-12 帧）
- 减少 DashScope WebSocket send() 调用次数

---

## 4. 数据流

### 4.1 客户端初始化流程

```
new App(rootSelector)
    ↓
阶段 1: UI 初始化（同步）
  ├── new ChatLayout()
  ├── initTheme()          // 订阅主题变化
  └── mount()              // DOM 渲染
    ↓
阶段 2: 运行时系统初始化（同步，不依赖网络）
  ├── ttsPlayback.init()                // 创建 AudioContext
  ├── wsClient.onMessage → messageRouter.route()    // 绑定消息处理
  ├── wsClient.onBinary → messageRouter.routeBinary() // 绑定二进制处理
  ├── messageRouter.start()             // 激活路由（isActive=true）
  ├── utteranceManager.setOnInterruptedCallback()    // 绑定打断回调
  └── ttsPlayback.setOnPlaybackComplete()              // 绑定播放完成回调
    ↓
阶段 3: 网络连接（异步）
  ├── wsClient.connect()
  └── wsClient.send({ type: 'session.start' })
```

**设计原则**：
- 所有**不依赖网络**的初始化（回调绑定、AudioContext 创建、路由启动）在 `constructor` 中同步完成
- 只有 WebSocket 连接是异步的，单独放在 `connectTransport()` 中
- 这样即使网络连接失败或重连，所有回调和处理器都已就绪，不会丢失事件

---

### 4.2 ASR 前后端交互详细流程

#### Phase 1: 进入 listening 状态（准备录音）

```
Backend: tts.complete → speaking → idle
    ↓
Frontend: playback.complete → voiceActor.send({ type: 'playback.complete' })
    ↓
Voice Machine: 'playback.complete' → target: 'idle'
    ↓
Voice Machine: idle (等待用户下一次交互)
    ↓
Frontend: 用户点击录音按钮 → voiceActor.send({ type: 'session.start' })
    ↓
Voice Machine idle.on → 'session.start':
  target: 'listening'
  actions: ['startTurn', 'startTurnTransport']
    ↓
Voice Machine: startTurn assign({ turnId: createNewTurnId() })
    ↓
Voice Machine: startTurnTransport action:
  1. utteranceManager.startTurnSync(context.turnId)  // 同步 turnId
  2. binaryTransport.startTurn(context.turnId)       // 激活 binaryTransport
  3. wsClient.send({ type: 'audio.start', turnId })  // 通知后端
    ↓
Frontend: listening.entry → startAudioRecording() → AudioWorklet 启动
    ↓
Backend: handleAudioStart(turnId):
  1. stopStreamingAsr()             // 停止旧 ASR stream
  2. frameBuffer.clear()             // 清空帧缓存
  3. asrFrameQueue = []              // 清空 ASR 队列
  4. actor.send({ type: 'START' })   // 后端状态机 → listening
  5. startStreamingAsr():            // 启动新 ASR stream
     - asrStreamController = new AbortController()
     - createFrameStream(controller)   // 异步生成器，从 asrFrameQueue 消费
     - asrWorker.stream(audioStream, signal, logger) // DashScope ASR
     - send({ type: SERVER_EVENTS.SESSION_STARTED })
    ↓
Backend: WebSocket → DashScope fun-asr-realtime
  - ws.on('open') → send({ action: 'run-task', task_id: 'xxx' })
  - ws.on('message') → task-started → resolve connection
    ↓
Backend log: "dashscope.asr.task_started" / "asr.stream.started"
```

**关键细节**：
- `turnId` 由 `voice-machine` 的 `startTurn` action 统一生成
- `startTurnTransport` 通过 `utteranceManager.startTurnSync(turnId)` 同步 turnId，避免 VAD 触发时生成冲突的 turnId
- `binaryTransport.startTurn()` 和 `audio.start` 在 `session.start` 时一次性完成，无需等待 VAD
- 后端 `handleAudioStart` 会无条件停止旧 ASR stream，防止多 turn 冲突
- **重要**：`handleAudioStart` **不清空 `asrFrameQueue`**（音频帧可能比 `audio.start` 消息更早到达网络层）

#### Phase 3: 音频流式传输（说话中）

```
AudioWorklet → processFrame:
  speechDetector.onFrame(samples) → 'SPEAKING'
    ↓
  flushPreRoll() → 发送预缓冲的 25 帧 (~500ms)
    ↓
  sendFrame(seq, pcmData) → binaryTransport.sendFrame({ seq, pcm })
    ↓
BinaryTransport:
  - 构建 binary frame: [seq: uint32 LE][PCM: Int16[]]
  - wsClient.sendBinary(frameData)
    ↓
WebSocket → Backend handleBinaryFrame(pcmData, seq):
  - frameBuffer.set(seq, pcmData)   // 按 seq 索引缓存
  - currentSeq = seq
  - asrFrameQueue.push(pcmData)     // 推入 ASR 消费队列
    ↓
Backend: asrWorker.stream() 中的 audioSendPromise:
  for await (const chunk of audioStream) {
    batchBuffer = Buffer.concat([batchBuffer, chunk])
    while (batchBuffer.length >= 3200) {  // 100ms @ 16kHz
      wsConn.send(batchBuffer.subarray(0, 3200), { binary: true })
      batchBuffer = batchBuffer.subarray(3200)
    }
  }
    ↓
DashScope ASR 返回:
  - event: 'result-generated' → sentence.sentence_end === false → asr.partial
  - event: 'result-generated' → sentence.sentence_end === true  → asr.final
    ↓
Backend: for await (const result of asrWorker.stream()):
  if (!result.isFinal):
    send({ type: SERVER_EVENTS.ASR_PARTIAL, text: result.text, sentenceId })
  else:
    send({ type: SERVER_EVENTS.ASR_FINAL, text: result.text, sentenceId })
    ↓
Frontend MessageRouter:
  ASR_PARTIAL → voiceActor.send({ type: 'asr.partial', text })
    ↓
  Voice Machine listening.on → 'asr.partial':
    actions: 'setPartialTranscript'
    setPartialTranscript: assign({
      partialTranscript: ({ event, context }) => {
        const text = event.text || ''
        if (!text) return context.partialTranscript  // 空 partial 不清空
        return text
      }
    })
    ↓
  InputBar.onStateChange:
    sentences = [...completedSentences]
    if (partialTranscript) sentences.push(partialTranscript)
    textarea.value = sentences.join('')
```

**关键细节**：
- 前端 `setPartialTranscript`：空 `asr.partial` **不清空**已有内容（阿里云 ASR 结束时会发送空 partial）
- 后端 `asrWorker.stream()`: `result.isFinal === true` 时 `sentenceId` 用于去重
- 音频帧通过 `seq`（uint32 LE）标识，后端 `frameBuffer` 按 seq 缓存

#### Phase 4: 用户点击停止（手动提交）

```
用户点击按钮 → InputBar.handleButtonClick:
  buttonVm.semantic === 'stop-recording'
    ↓
  voiceActor.send({ type: 'audio.commit.manual' })
    ↓
Voice Machine listening.on → 'audio.commit.manual':
  target: 'transcribing'
  actions: ['setAbortController', 'commitAudio', assign({ manualCommit: true })]
    ↓
commitAudio action:
  1. await binaryTransport.flush()  // 等待 websocket bufferedAmount === 0
  2. await binaryTransport.commit() // 发送 audio.commit 消息
     - finalSeq = this.lastSeq
     - wsClient.send({ type: 'audio.commit', turnId, finalSeq })
     - this.reset()  // isActive=false, currentTurnId='', lastSeq=-1
  3. utteranceManager.resetTurnState() // isActive=false, turnId=''
    ↓
Backend handleAudioCommit(turnId, finalSeq):
  1. for (let i = 0; i <= finalSeq; i++) {
       if (!frameBuffer.has(i)) log.warn('audio.commit.missing.seq')
     }
  2. frameBuffer.clear()
  3. actor.send({ type: 'VAD_END' })  // 后端状态机 → transcribing
  4. asrFrameQueue.push(Buffer.alloc(0)) // 触发 ASR stream 结束
  5. await asrStreamTask  // 等待 ASR 任务完成
  6. if (asrStreamTask === taskRef) asrStreamTask = null
    ↓
Backend: asrWorker.stream() 中的 audioSendPromise:
  for await (const chunk of audioStream):
    // Buffer.alloc(0) 触发 done=true，循环结束
  if (batchBuffer.length > 0) wsConn.send(batchBuffer)  // flush 剩余
  wsConn.send({ action: 'finish-task' })  // 通知 DashScope 结束
    ↓
DashScope 返回:
  event: 'task-finished' → finished = true
    ↓
Backend: qwen-asr.worker.ts:
  resolveNext({ text: '', isFinal: true })  // 空 final 保证流程不挂
    ↓
Backend: for await (const result of asrWorker.stream()):
  result.isFinal === true → send({ type: SERVER_EVENTS.ASR_FINAL, text: '' })
    ↓
Frontend MessageRouter:
  ASR_FINAL → voiceActor.send({ type: 'asr.final', text: '' })
    ↓
Voice Machine transcribing.on → 'asr.final':
  Guard 1: text.trim().length > 0 → false
  Guard 2: completedSentences.length > 0 || partialTranscript?.trim():
    - 如果 listening 阶段收到过非空 asr.final → completedSentences 有内容 → 通过
    - 如果 listening 阶段 asr.final 为空但 partialTranscript 有内容 → 通过
    - actions: ['appendPartialToCompleted', 'submitTranscript']
      appendPartialToCompleted:
        completedSentences.push(partialTranscript)
        partialTranscript = ''
      submitTranscript:
        text = completedSentences.join('') + partialTranscript
        chatStore.addMessage('user', text)
        wsClient.send({ type: 'submit.text', text })
    - target: 'thinking'
  Guard 3: 否则 → target: 'idle', actions: ['resetSession', 'showEmptyAsrToast']
    // "未识别文字"
```

**关键细节**：
- `audio.commit` 发送后，后端 `asrFrameQueue.push(Buffer.alloc(0))` 触发 ASR stream 结束
- `task-finished` 返回 `{ text: '', isFinal: true }`（空 final）是正常行为
- Guard 2 是**降级策略**：即使 final 为空，只要有 partial 内容就继续 LLM
- `submitTranscript` 同时检查 `completedSentences` 和 `partialTranscript`，确保提交的是用户看到的完整文字

#### Phase 5: ASR 多句场景（用户说了多句话）

```
用户说话期间:
  - asr.partial: "你好" → partialTranscript = "你好"
  - asr.partial: "你好北京" → partialTranscript = "你好北京"
  - asr.final:  "你好。" → completedSentences = ["你好。"], partialTranscript = ""
  - asr.partial: "今天天气" → partialTranscript = "今天天气"
  - asr.final:  "今天天气不错。" → completedSentences = ["你好。", "今天天气不错。"]
    ↓
用户点击 stop:
  submitTranscript:
    text = completedSentences.join('') = "你好。今天天气不错。"
    // 阿里云 SentenceEnd.result 已包含结尾标点，所以 join('') 即可
```

**关键细节**：
- 阿里云 `SentenceEnd.result` **已包含结尾标点**（如"你好。"），所以 `join('')` 即可，无需额外连接符
- `sentenceId` 用于去重，防止同一句话被重复 push

---

### 4.2 完整对话流程（全链路）

```
用户点击录音
    ↓
Frontend: session.start → audio.start (turnId)
    ↓
Backend: VoiceSession 创建 → startStreamingAsr()
    ↓
用户说话
    ↓
Frontend: AudioWorklet → VAD(SPEAKING) → 发送 binary PCM
    ↓
Backend: 接收帧 → batch 累积 → DashScope ASR
    ↓
Backend: asr.partial → Frontend (实时显示)
    ↓
用户点击停止
    ↓
Frontend: audio.commit.manual
    ↓
Backend: finish-task → asr.final → submit.text → LLM
    ↓
Backend: llm.token → Frontend (实时显示 Assistant 消息)
    ↓
Backend: tts.chunk → Frontend (流式播放音频)
    ↓
Backend: tts.complete → Frontend (state: idle)
    ↓
用户可开始下一轮对话
```

### 4.2 多 Turn 保护机制

```
Turn 1: audio.start → ASR Stream A 启动
    ↓
用户再次点击录音 (未等 Turn 1 结束)
    ↓
handleAudioStart:
  1. stopStreamingAsr() 中止 Stream A
  2. 清空 frameBuffer + asrFrameQueue
  3. startStreamingAsr() 启动 Stream B
    ↓
Stream A 结束时检查: this.asrStreamTask === taskRef?
  - 是 → 清零
  - 否 (已被 Stream B 覆盖) → 不操作
```

---

## 5. 前端架构

### 5.1 目录结构

```
frontend/src/app/
├── components/           # UI 组件
│   ├── ChatLayout.ts     # 主布局
│   ├── InputBar.ts       # 输入栏 (录音/文本)
│   ├── MessageList.ts    # 消息列表
│   └── Toast.ts          # 提示消息
├── voice/                # 语音状态管理
│   ├── machine/          # XState 状态机
│   │   ├── voice-machine.ts      # 主状态机
│   │   ├── voice-context.ts      # Context 定义
│   │   ├── voice-events.ts       # 事件类型
│   │   └── voice-actions.ts      # 共享 actions
│   ├── selectors/        # UI 派生状态
│   │   ├── actionButton.selector.ts  # 按钮语义
│   │   └── voiceStatus.selector.ts   # 状态显示
│   └── providers/
│       └── voice-provider.ts       # Actor 实例
├── runtime/              # 运行时基础设施
│   ├── audio/            # 音频系统
│   │   ├── recorder.ts         # AudioWorklet 封装
│   │   ├── speech-detector.ts  # VAD 检测
│   │   ├── utterance-manager.ts # Turn 管理
│   │   ├── pcm-pipeline.ts     # PCM 流水线
│   │   └── playback.ts         # TTS 播放
│   ├── transport/        # 网络传输
│   │   ├── websocket-client.ts  # WebSocket 封装
│   │   ├── message-router.ts    # 消息路由
│   │   └── binary-transport.ts  # 二进制发送
│   └── debug-provider.ts # 调试系统
├── state/                # 全局状态
│   ├── chatStore.ts      # 聊天消息
│   └── uiStore.ts        # UI 状态
└── utils/                # 工具函数
```

### 5.2 关键组件交互

```
App.ts
├── ChatLayout (UI 根组件)
│   ├── MessageList (消息展示)
│   └── InputBar (输入 + 录音按钮)
│       └── voiceActor.subscribe (监听状态变化)
│
voiceActor (XState Actor)
├── states: idle → listening → transcribing → thinking → speaking
├── context: transcript, partialTranscript, turnId, ...
└── actions: startTurn, commitAudio, setPartialTranscript, ...

AudioRecorder (AudioWorklet)
├── onPcmData → speechDetector.onFrame()
└── SPEAKING → utteranceManager.startTurn()

MessageRouter
├── onMessage → voiceActor.send(event)
└── routeBinary → ttsPlayback.onChunk()
```

---

## 6. 后端架构

### 6.1 VoiceSession 生命周期

```typescript
class VoiceSession {
  // 核心属性
  sessionId: string
  currentTurnId: string
  asrFrameQueue: Buffer[]
  asrStreamTask: Promise<void> | null
  
  // 核心方法
  handleAudioStart(turnId: string)      // 启动新 turn
  handleAudioCommit(turnId, finalSeq)   // 提交录音
  handleBinaryFrame(pcmData, seq)       // 接收音频帧
  startStreamingAsr()                   // 启动 ASR 流
  stopStreamingAsr()                    // 停止 ASR 流
  runLlm(transcript: string)            // 运行 LLM
  runTts(text: string)                  // 运行 TTS
}
```

### 6.2 Workers 设计

Workers 是无状态适配器，仅负责 AI 服务调用：

| Worker | 职责 | 流式方式 |
|--------|------|----------|
| `QwenAsrWorker` | DashScope fun-asr-realtime 语音识别 | WebSocket duplex |
| `QwenLlmWorker` | DashScope Qwen LLM 推理 | SSE stream |
| `AliyunStreamingTtsWorker` | 阿里云 NLS 语音合成 | WebSocket stream |

### 6.3 错误处理

```
Error Classification:
├── PermissionError   (麦克风权限被拒)
├── DeviceError       (无音频输入设备)
├── WebsocketError    (连接断开/超时)
├── NetworkError      (API 不可达)
└── LogicError        (状态机非法转换)
```

---

## 7. 测试策略

### 7.1 测试金字塔

```
        ┌─────────────────────────────┐
        │  Integration Tests (1)        │  Playwright + 真实后端
        │  真实 ASR → LLM → TTS 流程   │  (成本高，验证全链路)
        ├─────────────────────────────┤
        │  Mock E2E Tests (27)        │  Playwright + Mock WS
        │  模拟后端交互                 │  (CI 快速，覆盖 UI)
        ├─────────────────────────────┤
        │  Unit Tests (204)           │  Vitest
        │  前端: 156 / 后端: 41       │  (核心逻辑全覆盖)
        ├─────────────────────────────┤
        │  Lint + TypeCheck           │  CI 基础检查
        └─────────────────────────────┘
```

### 7.2 测试命令

```bash
# 前端单元测试
cd frontend && npx vitest run

# 后端单元测试
cd backend && npx vitest run

# Mock E2E 测试
npx playwright test self-healing/e2e/mocked/ -c self-healing/playwright.config.ts

# 集成测试 (真实后端)
npx playwright test self-healing/e2e/integration/ -c self-healing/playwright.integration.config.ts
```

---

## 8. 部署与配置

### 8.1 环境变量

```bash
# 前端 (.env)
VITE_LOG_LEVEL=info        # debug/info/warn/error
VITE_WS_URL=ws://localhost:3000/ws

# 后端 (.env)
QWEN_API_KEY=sk-xxx        # DashScope API Key
TTS_MODE=websocket         # websocket / http
NLS_TTS_TOKEN=xxx          # 阿里云 NLS Token
ASR_FORMAT=pcm             # pcm / opus
ASR_SAMPLE_RATE=16000
```

### 8.2 启动流程

```bash
# 1. 安装依赖
pnpm install

# 2. 启动后端
cd backend && pnpm dev
# → http://localhost:3000

# 3. 启动前端
cd frontend && pnpm dev
# → http://localhost:5173

# 4. 访问
open http://localhost:5173
```

---

## 9. 关键设计决策

### 9.1 为什么不用 React/Vue？

- 项目聚焦实时语音交互，DOM 操作极简
- 状态由 XState 统一管理，无需框架级状态管理
- 减少依赖，降低构建体积和复杂度

### 9.2 为什么手动提交而非自动？

- 避免 VAD 误判导致截断（尤其中文尾音轻）
- 用户有控制权，可补充修正
- 减少后端无效 ASR 请求

### 9.3 为什么 100ms Batch 发送？

- 前端帧率 8ms（125 帧/秒），后端若逐帧发送会积压
- DashScope 推荐流式粒度 20-100ms
- 3200 bytes (100ms) 是 256 bytes/frame 的整数倍，无 padding

### 9.4 为什么单连接复用而非每 turn 新建？

- DashScope fun-asr-realtime 支持 `heartbeat: true` 保活
- 首包延迟从 300-800ms 降至 0ms
- 60s 空闲超时，finish-task 后连接保持，可复用

---

## 10. 已知问题与优化

### 10.1 已修复

| 问题 | 根因 | 修复 |
|------|------|------|
| ASR 延迟 4 分钟 | 50ms 节流导致队列积压 7000+ | 100ms batch 发送 |
| 多 turn 冲突 | ASR task 引用被旧任务覆盖 | Task 引用保护 + 无条件停止旧流 |
| TTS 解析错误 | WebSocket binaryType 默认 blob | 显式设为 arraybuffer |
| 空 ASR 误报 | final 为空但 partial 有内容 | 降级使用 partial |
| 实时文字不显示 | listening 状态未展示 partial | 添加 listening 到显示条件 |

### 10.2 待优化

| 优化项 | 说明 | 优先级 |
|--------|------|--------|
| DashScope 预连接 | 页面加载时预建 ASR 连接 | 低 |
| ASR 上下文传递 | 多 turn 间传递前文提高识别率 | 中 |
| 音频质量增强 | 降噪、回声消除 | 中 |
| 移动端适配 | 触摸事件、屏幕适配 | 低 |

---

## 11. 调试与诊断

### 11.1 浏览器控制台

```javascript
// 查看状态快照
__VOICE_DEBUG__.getSnapshot()

// 查看管道统计
__VOICE_DEBUG__.getPipelineStats()

// 临时启用 debug 日志
__VOICE_DEBUG__.setLogLevel('debug')
```

### 11.2 后端日志

```bash
# 实时查看 ASR 事件
tail -f backend/dev.log | grep -E "asr\.(partial|final)|audio\.(start|commit)"
```

---

## 12. 参考资料

- [XState v5 Documentation](https://xstate.js.org/docs/)
- [DashScope fun-asr-realtime](https://help.aliyun.com/document_detail/2712536.html)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)

---

*文档版本: v1.1 | 更新日期: 2025-05-25*

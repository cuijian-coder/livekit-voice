# 网络架构 (Network Architecture)

## 整体链路

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    用户浏览器 / 前端                                         │
│                                        ws://127.0.0.1:3000/ws                               │
└───────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                        │ HTTP + WebSocket
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              本地后端服务器 (Node.js)                                        │
│                                  ws://0.0.0.0:3000                                          │
│                                     TTS_MODE=websocket                                       │
└───────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                        │
           ┌───────────────────────────┼───────────────────────────┬──────────────────────┐
           │                           │                           │                      │
           ▼                           ▼                           ▼                      ▼
┌──────────────────┐    ┌──────────────────────────┐    ┌────────────────────┐    ┌──────────────────┐
│       ASR        │    │          LLM             │    │        TTS        │    │     其他         │
│   语音识别        │    │     大语言模型           │    │     语音合成        │    │                  │
├──────────────────┤    ├──────────────────────────┤    ├────────────────────┤    ├──────────────────┤
│ 协议: WebSocket  │    │ 协议: HTTPS POST        │    │ 协议: WebSocket    │    │                  │
│ 方式: 流式       │    │ 方式: SSE (流式响应)      │    │ 方式: 流式        │    │                  │
├──────────────────┤    ├──────────────────────────┤    ├────────────────────┤    ├──────────────────┤
│ URL:             │    │ URL:                    │    │ URL:               │    │                  │
│ wss://dashscope  │    │ https://dashscope.      │    │ wss://nls-gateway- │    │                  │
│ .aliyuncs.com/   │    │ aliyuncs.com/compatibl   │    │ cn-shanghai.       │    │                  │
│ api-ws/v1/       │    │ e-mode/v1/chat/          │    │ aliyuncs.com/      │    │                  │
│ inference        │    │ completions             │    │ ws/v1?token=...    │    │                  │
├──────────────────┤    ├──────────────────────────┤    ├────────────────────┤    ├──────────────────┤
│ 认证: Bearer     │    │ 认证: Bearer             │    │ 认证: Token (URL)  │    │                  │
│ (API Key)        │    │ (API Key)               │    │                    │    │                  │
├──────────────────┤    ├──────────────────────────┤    ├────────────────────┤    ├──────────────────┤
│ 模型: fun-asr-   │    │ 模型: qwen-turbo        │    │ 音色: xiaoyun      │    │                  │
│ realtime         │    │                          │    │ 格式: wav          │    │                  │
└──────────────────┘    └──────────────────────────┘    │ 采样率: 16000Hz    │    │                  │
                                                         └────────────────────┘    │                  │
                                                                                      ▼                  │
                                                         ┌──────────────────────────────┐    │
                                                         │ 阿里云上海region (外网)       │    │
                                                         └──────────────────────────────┘    │
```

## 节点详情

| 节点 | 协议 | 方式 | URL | 认证 |
|------|------|------|-----|------|
| **前端 → 后端** | WebSocket | 长连接 | `ws://127.0.0.1:3000/ws` | 无 (本地) |
| **后端 → ASR** | WebSocket | 流式 | `wss://dashscope.aliyuncs.com/api-ws/v1/inference` | Bearer Token (QWEN_API_KEY) |
| **后端 → LLM** | HTTPS | SSE | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | Bearer Token (QWEN_API_KEY) |
| **后端 → TTS** | WebSocket | 流式 | `wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1?token=...` | Token (NLS_TTS_TOKEN) |

## 各节点详细说明

### 1. 前端 ↔ 后端 (WebSocket)

| 属性 | 值 |
|------|---|
| 协议 | WebSocket |
| URL | `ws://127.0.0.1:3000/ws` |
| 用途 | 实时双向通信：发送音频、接收ASR/LLM/TTS结果 |
| 认证 | 无 (本地通信) |

### 2. 后端 → ASR (DashScope Fun-ASR Realtime)

| 属性 | 值 |
|------|---|
| 协议 | WebSocket (wss://) |
| URL | `wss://dashscope.aliyuncs.com/api-ws/v1/inference` |
| 用途 | 实时语音识别 |
| 认证 | `Authorization: Bearer {QWEN_API_KEY}` |
| 模型 | `fun-asr-realtime` |
| 音频格式 | PCM, 16kHz, 16bit mono |
| 响应 | 流式返回识别文本 |

**请求格式**:
```json
{
  "header": {
    "action": "run-task",
    "task_id": "uuid",
    "streaming": "duplex"
  },
  "payload": {
    "task_group": "audio",
    "task": "asr",
    "function": "SpeechRecognition",
    "model": "fun-asr-realtime",
    "parameters": {
      "format": "pcm",
      "sample_rate": 16000,
      "language": "zh"
    },
    "input": {}
  }
}
```

### 3. 后端 → LLM (DashScope Qwen Turbo)

| 属性 | 值 |
|------|---|
| 协议 | HTTPS POST |
| URL | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| 用途 | 大语言模型对话 |
| 认证 | `Authorization: Bearer {QWEN_API_KEY}` |
| 模型 | `qwen-turbo` |
| 响应格式 | Server-Sent Events (SSE) |

**请求格式**:
```json
{
  "model": "qwen-turbo",
  "messages": [
    {"role": "user", "content": "北京的天气"}
  ],
  "stream": true
}
```

### 4. 后端 → TTS (NLS Gateway WebSocket)

| 属性 | 值 |
|------|---|
| 协议 | WebSocket (wss://) |
| URL | `wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1?token={NLS_TTS_TOKEN}` |
| 用途 | 实时语音合成 |
| 认证 | Token 在 URL 参数中 |
| 音色 | `xiaoyun` (通过 NLS_TTS_VOICE 配置) |
| 格式 | WAV (通过 NLS_TTS_FORMAT 配置) |
| 采样率 | 16000Hz (通过 NLS_TTS_SAMPLE_RATE 配置) |
| 响应 | 流式返回 WAV 二进制音频 |

**请求流程**:
1. 发送 `StartSynthesis` 指令 → 等待 `SynthesisStarted` 响应
2. 发送 `RunSynthesis` 指令 + 文本 → 接收音频流
3. 发送 `StopSynthesis` 指令 (延迟5秒) → 等待 `SynthesisCompleted`

## 环境配置

### 必需环境变量

```bash
# 通用认证 (ASR/LLM 共用)
QWEN_API_KEY=sk-82acc8e4d9bd44be9619b363ffdb2c81

# ASR 配置
ASR_MODEL=fun-asr-realtime
ASR_FORMAT=pcm
ASR_SAMPLE_RATE=16000

# LLM 配置
LLM_MODEL=qwen-turbo

# TTS 配置
NLS_TTS_APPKEY=QWLkOIkcMQQzHpas
NLS_TTS_TOKEN=73a655e6677941598ea98e649a5a883a
NLS_TTS_VOICE=xiaoyun
NLS_TTS_FORMAT=wav
NLS_TTS_SAMPLE_RATE=16000

# TTS 模式: http (HTTP异步轮询) 或 websocket (WebSocket流式)
TTS_MODE=websocket
```

### AI 服务端点汇总

| 组件 | 服务商 | 协议 | 区域 | 端点 |
|------|--------|------|------|------|
| ASR | DashScope | WebSocket | 外网 | `wss://dashscope.aliyuncs.com/api-ws/v1/inference` |
| LLM | DashScope | HTTPS | 外网 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| TTS | NLS Gateway | WebSocket | 上海 | `wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1` |

## 链路特点

1. **前端 → 后端**: WebSocket 长连接，用于实时双向通信
2. **ASR**: DashScope WebSocket 流式识别，实时处理音频流
3. **LLM**: DashScope HTTPS SSE 流式响应，逐 token 返回
4. **TTS**: NLS Gateway WebSocket 流式合成，实时返回音频帧

所有外部连接均通过阿里云外网访问上海 region。

## 性能指标参考

使用 `nls-sample-16k.wav` (106KB, 约6.7秒@16kHz) 测试的典型耗时：

| 阶段 | 耗时 |
|------|------|
| 音频发送 → ASR完成 | ~2.4s |
| ASR → LLM开始 | ~0s |
| LLM → TTS开始 | ~0.6s |
| TTS首帧 → 播放完成 | ~15s |
| **总耗时** | ~19s |
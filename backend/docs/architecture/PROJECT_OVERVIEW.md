# Project Overview

## 项目名称

LiveKit Voice Chat Backend

## 项目目标

构建实时 AI 语音对话后端运行时，支持端到端流式语音交互（麦克风 → ASR → LLM → TTS → 扬声器），具备实时中断、错误恢复和会话管理能力。

## 核心能力

| 能力 | 描述 |
|------|------|
| 实时音频流 | WebSocket 双向音频流传输 |
| 流式 ASR | 语音识别流式输出 |
| 流式 LLM | 大语言模型流式响应 |
| 流式 TTS | 语音合成流式音频输出 |
| 打断处理 | 全链路可中断 |
| 运行时恢复 | 错误自动恢复 |
| 会话管理 | 有状态会话生命周期 |

## 技术选型

### 运行时

| 技术 | 用途 |
|------|------|
| Node.js | 运行时 |
| TypeScript | 类型安全 |
| Fastify | HTTP/WebSocket 服务器 |
| ws | WebSocket 底层 |
| XState v5 | 高层对话状态机 |

### AI 服务

| 组件 | 服务 |
|------|------|
| ASR | 通义千问 ASR API |
| LLM | 通义千问 Qwen API (OpenAI 兼容) |
| TTS | 通义千问 CosyVoice / TTS API |

## 当前阶段

**Phase 1: 实时语音运行时** ✅ 已完成

目标：Mic → ASR → LLM → TTS → Speaker

- [x] WebSocket 网关
- [x] VoiceSession 运行时
- [x] XState 状态机
- [x] 流式 ASR Worker (Fun-ASR Realtime)
- [x] 流式 ASR Worker (Qwen ASR)
- [x] 流式 LLM Worker (Qwen Turbo)
- [x] 流式 TTS Worker (NLS Gateway HTTP + WebSocket)
- [x] 流式 TTS Worker (Aliyun Streaming WebSocket)
- [x] 回放队列
- [x] 打断处理
- [x] 诊断系统
- [x] Streaming ASR (帧实时发送，partial 结果带 seq)

## 系统边界

### 包含

- WebSocket 实时通信
- 流式 AI 处理管道
- 会话生命周期管理
- 运行时诊断
- 错误恢复

### 不包含

- 用户认证
- 消息持久化
- 分布式架构
- 多租户
- 插件系统

## 环境配置

### .env 必需变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `QWEN_API_KEY` | DashScope API Key | (必填) |
| `QWEN_API_BASE` | API Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `LLM_MODEL` | LLM 模型 | `qwen-turbo` |
| `LLM_TEMPERATURE` | LLM 温度 | `0.7` |
| `LLM_MAX_TOKENS` | 最大 token 数 | `2000` |
| `ASR_MODEL` | ASR 模型 | `fun-asr-realtime` |
| `ASR_FORMAT` | 音频格式 | `pcm` |
| `ASR_SAMPLE_RATE` | 采样率 | `16000` |
| `TTS_MODE` | TTS 模式 | `http` (可选 `websocket`) |
| `NLS_TTS_APPKEY` | NLS Gateway Appkey | (TTS 必填) |
| `NLS_TTS_TOKEN` | NLS Gateway Token | (TTS 必填) |
| `NLS_TTS_VOICE` | NLS TTS 音色 | `xiaoyun` |
| `NLS_TTS_FORMAT` | NLS TTS 格式 | `wav` |
| `NLS_TTS_SAMPLE_RATE` | NLS TTS 采样率 | `16000` |

### AI 服务详情

| 组件 | 服务 | 协议 | 端点 |
|------|------|------|------|
| ASR | 通义 Fun-ASR | WebSocket | `wss://dashscope.aliyuncs.com/api-ws/v1/inference` |
| LLM | 通义 Qwen Turbo | HTTP SSE | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| TTS (HTTP) | NLS Gateway 异步 | HTTPS | `https://nls-gateway-cn-shanghai.aliyuncs.com/rest/v1/tts/async` |
| TTS (WebSocket) | NLS Gateway 流式 | WebSocket | `wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1` |

> 详细网络架构图和链路说明请参考 [NETWORK_ARCHITECTURE.md](./NETWORK_ARCHITECTURE.md)

### TTS 模式

TTS 支持两种模式，通过 `TTS_MODE` 环境变量切换：

| 模式 | 说明 | 特点 |
|------|------|------|
| `http` | HTTP 异步轮询 | 3步：提交任务 → 轮询结果 → 下载音频 |
| `websocket` | WebSocket 流式 | 实时流式输出，低延迟 |

## 非目标 (当前阶段)

| 非目标 | 原因 |
|--------|------|
| REST-heavy | WebSocket 为主 |
| Database | 内存会话存储 |
| Microservices | 单体运行时 |
| Distributed | Phase 1 单机部署 |
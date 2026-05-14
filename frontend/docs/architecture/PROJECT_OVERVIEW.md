# Project Overview

## 项目名称

LiveKit Voice Chat UI

## 项目目标

构建 ChatGPT 风格的实时语音对话 UI 系统，基于 Vite + Vanilla TypeScript + XState v5。

## 核心能力

| 能力 | 描述 |
|------|------|
| 实时语音录制 | 麦克风采集音频 |
| 流式对话 | LLM 流式输出响应 |
| 实时语音合成 | TTS 流式输出音频 |
| 打断功能 | 支持在 AI 说话时随时打断 (Barge-in) |
| 状态可视化 | XState 状态机管理 |
| 运行时诊断 | 日志 + 验证 + 时间线 |

## 当前阶段

**Phase 1: 基础设施 + 状态机**

- [x] Vite + TypeScript 项目初始化
- [x] XState v5 状态机 (线性)
- [x] 运行时诊断系统 (Logger + Invariant + Validation)
- [x] 单元测试覆盖 (160 tests)
- [ ] 集成真实语音服务 (LiveKit)
- [ ] Audio 录制与播放
- [ ] Streaming 集成

## 技术选型

### 前端

| 技术 | 用途 |
|------|------|
| Vite | 开发服务器 + 构建 |
| TypeScript | 类型安全 |
| XState v5 | 状态管理 (并行状态支持) |
| DOM API | UI 构建 (非 React) |

### 状态管理

| 组件 | 用途 |
|------|------|
| voiceMachine | 主状态机 (idle → listening → thinking → streaming → playing) |
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
- 运行时诊断系统
- 单元测试

### 不包含

- 后端服务 (LiveKit 后端)
- 用户认证
- 消息存储

## 非目标 (当前阶段)

| 非目标 | 原因 |
|--------|------|
| React/Vue | 使用 Vanilla TypeScript |
| Electron | 纯浏览器端 |
| WebRTC | 使用 LiveKit SDK |
| 复杂动画 | MVP 阶段简化 |

## 关键约束

1. **无框架**: 使用 Vanilla TypeScript + DOM API
2. **XState v5**: 使用最新版本 XState
3. **前端自治**: Browser-first 架构
4. **测试驱动**: 160+ 单元测试覆盖

## 参考资料

- [XState v5](https://xstate.js.org/docs/)
- [Vite](https://vitejs.dev/)
- [LiveKit](https://docs.livekit.io/)
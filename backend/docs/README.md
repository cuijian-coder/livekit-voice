# Documentation

## 目录

### Architecture (架构)

| 文件 | 描述 |
|------|------|
| [PROJECT_OVERVIEW.md](./architecture/PROJECT_OVERVIEW.md) | 项目概述、技术选型、系统边界、环境配置 |
| [BACKEND_ARCHITECTURE.md](./architecture/BACKEND_ARCHITECTURE.md) | 后端架构、目录结构、核心模块 |
| [NETWORK_ARCHITECTURE.md](./architecture/NETWORK_ARCHITECTURE.md) | 网络架构、链路图、各节点详细说明 |

### Protocol (协议)

| 文件 | 描述 |
|------|------|
| [BACKEND_STATE_MACHINE.md](./protocol/BACKEND_STATE_MACHINE.md) | XState 状态机定义、状态转换、Context 结构 |
| [WEBSOCKET_PROTOCOL.md](./protocol/WEBSOCKET_PROTOCOL.md) | WebSocket 通信协议、消息格式、帧类型 |

### Testing (测试)

| 文件 | 描述 |
|------|------|
| [TESTING_STRATEGY.md](./testing/TESTING_STRATEGY.md) | 测试策略、测试覆盖、测试命令 |

### Diagnostics (诊断)

| 文件 | 描述 |
|------|------|
| [RUNTIME_DIAGNOSTICS.md](./diagnostics/RUNTIME_DIAGNOSTICS.md) | 运行时诊断系统、日志、延迟追踪 |

## 快速链接

- [项目概述](./architecture/PROJECT_OVERVIEW.md)
- [后端架构](./architecture/BACKEND_ARCHITECTURE.md)
- [网络架构](./architecture/NETWORK_ARCHITECTURE.md)
- [状态机](./protocol/BACKEND_STATE_MACHINE.md)
- [WebSocket 协议](./protocol/WEBSOCKET_PROTOCOL.md)
- [测试策略](./testing/TESTING_STRATEGY.md)
- [运行时诊断](./diagnostics/RUNTIME_DIAGNOSTICS.md)

## 常用命令

```bash
# 安装依赖 (在项目根目录)
cd ../ && pnpm install

# 开发模式 (热重载)
cd ../ && pnpm --filter backend run dev

# 类型检查
cd ../ && pnpm --filter backend run typecheck

# 代码规范
cd ../ && pnpm --filter backend run lint

# 运行测试
cd ../ && pnpm --filter backend run test:run
```

## 技术栈

- **Runtime**: Node.js
- **Language**: TypeScript
- **Web Framework**: Fastify
- **WebSocket**: ws
- **State Machine**: XState v5
- **AI Providers**: 通义千问 (ASR / LLM / TTS)

## 设计原则

- **Streaming-first**: 全链路流式处理
- **Interruptible**: 随时可打断
- **Session-oriented**: 会话隔离
- **Event-driven**: 事件驱动编排
- **Recovery-first**: 错误优先恢复

## 核心特性

| 特性 | 描述 |
|------|------|
| Streaming ASR | 帧实时发送，partial 结果带 seq |
| Continuous Turn | audio.start → frames → audio.commit |
| Duplex TTS | 流式音频输出，支持中断 |
| turn.cancel | 打断时取消当前 turn |

## 会话生命周期

```
audio.start (turnId)           Turn 开始
    │
    ├─ frames 实时发送 → ASR worker
    │
    ▼
asr.partial { turnId, seq, text }  实时返回
    │
    ▼
audio.commit (turnId, finalSeq)    Turn 结束
    │
    ├─ asr.final 返回
    ├─ llm 推理
    └─ tts 流式输出
    │
    ▼
turn.cancel (turnId)           Turn 取消（打断）
```
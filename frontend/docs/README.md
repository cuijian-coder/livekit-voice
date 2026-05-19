# Documentation

## 目录

### Architecture (架构)

| 文件 | 描述 |
|------|------|
| [PROJECT_OVERVIEW.md](./architecture/PROJECT_OVERVIEW.md) | 项目概述、技术选型、系统边界 |
| [FRONTEND_ARCHITECTURE.md](./architecture/FRONTEND_ARCHITECTURE.md) | 前端架构、目录结构、核心模块 |

### Protocol (协议)

| 文件 | 描述 |
|------|------|
| [STATE_MACHINE.md](./protocol/STATE_MACHINE.md) | XState 状态机定义、状态转换、Context 结构 |

### Testing (测试)

| 文件 | 描述 |
|------|------|
| [TESTING_STRATEGY.md](./testing/TESTING_STRATEGY.md) | 测试策略、测试覆盖、测试命令 |

### Diagnostics (诊断)

| 文件 | 描述 |
|------|------|
| [RUNTIME_DIAGNOSTICS.md](./diagnostics/RUNTIME_DIAGNOSTICS.md) | 运行时诊断系统、Logger、Validation、Timeline |

## 快速链接

- [项目概述](./architecture/PROJECT_OVERVIEW.md)
- [前端架构](./architecture/FRONTEND_ARCHITECTURE.md)
- [状态机](./protocol/STATE_MACHINE.md)
- [测试策略](./testing/TESTING_STRATEGY.md)
- [运行时诊断](./diagnostics/RUNTIME_DIAGNOSTICS.md)

## 核心特性

### 连续双工语音系统

| 特性 | 描述 |
|------|------|
| Always-on Recording | 麦克风持续采集，VAD 只控制 UI 不阻塞发送 |
| Silence Auto-commit | 600ms 静音自动触发 audio.commit |
| Continuous Conversation | TTS 结束后回到 listening，持续对话 |
| Barge-in | 用户可在助手说话时打断 |

### 三层架构

```
┌─────────────────────────────────┐
│     Voice Machine (XState)      │  状态管理、对话流程
├─────────────────────────────────┤
│     UtteranceManager            │  Turn 生命周期、自动提交
├─────────────────────────────────┤
│     SpeechDetector              │  VAD、能量检测、打断检测
└─────────────────────────────────┘
```

## 常用命令

```bash
# 安装依赖 (在项目根目录)
cd .. && pnpm install

# 开发模式
cd .. && pnpm --filter frontend run dev

# 类型检查
pnpm --filter frontend run typecheck

# 代码规范
pnpm --filter frontend run lint

# 运行测试
pnpm --filter frontend run test:run
```

## 当前状态

- **测试覆盖**: 186 个测试，100% 通过
- **文档状态**: 连续双工语音系统文档已完成
- **核心模块**: SpeechDetector, UtteranceManager, BinaryTransport

## 技术栈

- **构建工具**: Vite
- **包管理器**: pnpm workspace
- **语言**: TypeScript (Vanilla, 无框架)
- **状态管理**: XState v5
- **测试**: Vitest
- **样式**: CSS (无预处理器)
- **共享包**: @livekit-voice/shared
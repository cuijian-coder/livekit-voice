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

## 常用命令

```bash
# 运行测试
npm run test:run

# 类型检查
npx tsc --noEmit

# 代码规范
npm run lint

# 启动开发服务器
npm run dev
```

## 当前状态

- **测试覆盖**: 160 个测试，100% 通过
- **文档状态**: MVP 完成
- **后续计划**: 添加更多诊断工具和调试面板
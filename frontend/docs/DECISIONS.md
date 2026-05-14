# Decisions

## 设计决策记录

### Decision 001: 使用 Vanilla TypeScript，无框架

**日期**: 项目初始化时

**决定**: 不使用 React/Vue/Angular，选择 Vanilla TypeScript + DOM API

**原因**:
- 项目目标明确：轻量级语音聊天 UI
- 无需复杂 UI 框架
- 减少依赖，简化构建
- XState 足以处理状态管理

**影响**:
- 需要手动处理 DOM 操作
- 无组件复用机制
- 适合当前项目规模

---

### Decision 002: 使用线性状态机

**日期**: 修复 XState 并行状态 target 错误时

**决定**: 使用线性状态机而非 parallel states

**原因**:
- XState v5 parallel states 的 target 语法复杂
- 当时的 target 问题导致页面空白
- 当前功能不需要 audio + conversation 完全独立

**原选项**:
1. ✅ 线性状态机 (当前方案)
2. ❌ Parallel states (语法复杂)

**影响**:
- 简化了实现
- 未来如需 barge-in 功能需要重构为 parallel states

---

### Decision 003: 简化日志系统

**日期**: 初始设计日志系统时

**决定**: 仅实现内存缓冲 + console 输出，不做 remote telemetry

**原因**:
- 当前阶段不需要远程监控
- 避免过度工程
- 150 行代码足够调试

**原选项**:
1. ✅ 简化版 (150 行)
2. ❌ 完整版 (transports, metrics, remote)

**影响**:
- 调试依赖 console
- 未来可扩展

---

### Decision 004: Selector 派生 UI 状态

**日期**: 设计 XState 与 UI 交互时

**决定**: 使用 selector 从 snapshot 派生 UI 状态，而非直接映射

**原因**:
- 保持 machine 纯净
- UI 状态可以灵活派生
- 解耦逻辑与视图

**实现**:
```typescript
// selector 派生
function selectActionButton(snapshot, hasInput): ButtonViewModel {
  const state = snapshot.value as string
  // 根据 state + hasInput 派生按钮状态
}
```

---

### Decision 005: 诊断系统 DEV/PROD 分离

**日期**: 实现 invariant 系统时

**决定**: DEV 模式抛出 Error，PROD 模式仅警告

**原因**:
- 开发时及时发现问题
- 生产环境不中断流程

**实现**:
```typescript
const isDev = import.meta.env.DEV
if (!condition) {
  logger.error(...)
  if (isDev) throw new Error(...)  // DEV only
  else console.warn(...)           // PROD
}
```

---

### Decision 006: 简化 Selector 测试

**日期**: 添加 selectors 单元测试时

**决定**: 使用手动的 snapshot 对象而非测试 XState actor

**原因**:
- XState actor 测试需要完整的 machine 实例
- 直接测试 selector 函数更简单
- 聚焦纯函数逻辑

**实现**:
```typescript
// 直接创建 snapshot 对象
const snapshot = { value: 'idle', context: {...} }
const result = selectActionButton(snapshot, false)
expect(result.semantic).toBe('record')
```

---

### Decision 007: 按钮样式与状态分离

**日期**: 设计 interrupt 按钮样式时

**决定**: interrupt 按钮复用 listening 状态的样式（蓝色背景 + 呼吸动画）

**原因**:
- 视觉一致性
- 强调"正在处理"的状态
- 区别于 idle 状态的浅蓝色

---

## 待记录决策

- [ ] 关于音频能量检测算法的选择
- [ ] 关于声波动画实现方式的决策
- [ ] 关于 LiveKit 集成方式的规划
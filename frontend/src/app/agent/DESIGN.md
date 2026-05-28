# Agent Module Design Document

## 1. 模块概述

Agent 模块是前端与机器人控制 Agent 之间的 WebSocket 通信层，负责将用户的 capability 指令发送到机器人，并接收机器人的实时状态、日志和执行结果。

### 1.1 设计目标

- **事件驱动协议**：基于 WebSocket 的双向事件通信，非 RPC
- **请求-响应关联**：通过 `request_id` 关联异步 execute 请求和 result
- **实时状态同步**：接收 `robot.state` 和 `robot.log` 实时更新
- **与现有聊天 UI 集成**：通过 `robot-command` / `robot` 消息角色融入 MessageList

### 1.2 架构定位

```
Frontend (Vanilla TypeScript)
    ├── Voice Chat (ASR → LLM → TTS)
    └── Agent Module (this)  ←→  FastAPI Agent (独立服务)
            ├── WebSocket 连接
            ├── XState 状态机
            └── Capability Registry
```

---

## 2. 协议设计

### 2.1 消息类型

所有消息使用统一的 JSON 事件格式，包含 `type` 字段。

#### 发送（Frontend → Agent）

```json
// 执行 capability
{
  "type": "execute",
  "request_id": "uuid-v4",
  "capability": "arm.move",
  "payload": { "x": 100, "y": 50, "z": 20 }
}

// 取消执行
{
  "type": "cancel",
  "request_id": "uuid-v4"
}

// 心跳响应
{
  "type": "heartbeat.ack",
  "timestamp": 1699123456789
}
```

#### 接收（Agent → Frontend）

```json
// 执行结果
{
  "type": "execute.result",
  "request_id": "uuid-v4",
  "success": true,
  "capability": "arm.move",
  "result": { "message": "移动完成" }
}

// 机器人状态
{
  "type": "robot.state",
  "busy": true,
  "position": { "x": 100, "y": 50, "z": 20 },
  "status": "moving"
}

// 机器人日志
{
  "type": "robot.log",
  "level": "info",
  "message": "开始移动...",
  "timestamp": 1699123456789
}

// Agent 错误
{
  "type": "agent.error",
  "message": "连接超时",
  "code": 5001
}

// 心跳
{
  "type": "heartbeat",
  "timestamp": 1699123456789
}
```

### 2.2 请求-响应关联

```
Frontend                    Agent
   │                          │
   ├─ execute (req_id: A) ──▶│
   │                          ├── 执行中
   │◀─ robot.log ─────────────┤
   │◀─ robot.state ───────────┤
   │                          ├── 完成
   │◀─ execute.result (A) ────┤
```

`request_id` 使用 `crypto.randomUUID()` 生成，AgentClient 内部维护 `pendingRequests` Map 进行 Promise 解析。

---

## 3. 状态机设计

### 3.1 XState v5 状态图

```
disconnected ──connect──▶ connecting ──connect──▶ idle
                                              │
                    ┌─────────────────────────┤
                    │                         │
                    │                    execute
                    │                         ▼
                    │                    executing ──result(success, busy=false)──▶ idle
                    │                         │
                    │                         │ result(success, busy=true)
                    │                         ▼
                    │                        busy
                    │                         │
                    │                         │ robot.state (busy=false)
                    └─────────────────────────┘
                    │
                    │ error
                    ▼
                  error
                    │
                    │ connect
                    └─────▶ connecting
```

### 3.2 状态说明

| 状态 | 说明 |
|------|------|
| `disconnected` | 初始状态，未连接 Agent |
| `connecting` | 正在建立 WebSocket 连接 |
| `idle` | 已连接，空闲状态，可执行新命令 |
| `executing` | execute 请求已发送，等待 execute.result |
| `busy` | 机器人正在执行物理动作（从 result 或 robot.state 推断） |
| `error` | 连接或执行出错 |

### 3.3 关键设计决策

- **busy 状态独立**：从 `executing` 分离，因为 execute.result 返回后机器人可能仍在物理移动
- **自动恢复**：error 状态下可重新 connect，不阻塞主应用
- **日志缓冲区**：最多保留 100 条 robot.log，防止内存泄漏

---

## 4. 核心模块

### 4.1 AgentClient (`agent-client.ts`)

WebSocket 封装类，提供 Promise-based API：

```ts
class AgentClient {
  connect(): Promise<void>
  execute(capability: string, payload?: object): Promise<ExecuteResultMessage>
  cancel(requestId: string): void
  disconnect(): void
  onMessage(handler: (msg: AgentMessage) => void): () => void
  onStateChange(handler: (state: ConnectionState) => void): () => void
}
```

**特性**：
- 自动重连（指数退避，最多 5 次）
- 内置心跳（15s interval）
- execute 超时（30s）
- 连接断开时自动 reject 所有 pending 请求

### 4.2 Capability Registry (`capability-registry.ts`)

硬编码 capability 定义，包含参数验证：

```ts
CAPABILITY_REGISTRY = {
  'arm.move': {
    id: 'arm.move',
    name: '移动机械臂',
    params: { x: { type: 'number', required: true }, ... }
  },
  'arm.home': {
    id: 'arm.home',
    name: '机械臂归位',
    params: {}
  }
}
```

提供 `validateCapabilityPayload()` 进行参数校验。

### 4.3 Agent Machine (`agent-machine.ts`)

XState v5 状态机，管理 Agent 生命周期和机器人状态：

```ts
const agentMachine = createMachine({
  id: 'agent',
  initial: 'disconnected',
  context: {
    connectionState: 'disconnected',
    robotState: null,
    logs: [],
    pendingRequestIds: new Set(),
    errorMessage: null,
    capabilities: [],
  },
  states: { disconnected, connecting, idle, executing, busy, error }
})
```

---

## 5. UI 集成

### 5.1 MessageList 消息角色

新增两种 `MessageRole`：

| 角色 | 方向 | 样式 | 示例内容 |
|------|------|------|----------|
| `robot-command` | 用户→机器人 | 右侧蓝色气泡，前缀 🤖 | "🤖 移动机械臂到 (100, 50, 20)" |
| `robot` | 机器人→用户 | 左侧灰色系统通知，小号字体 | "✅ 移动完成" / "📍 当前位置：x=100..." |

### 5.2 斜杠命令

InputBar 支持 `/` 命令：

```
/arm home              → arm.home
/arm move 100 50 20    → arm.move {x:100, y:50, z:20}
```

普通文本 → 走现有 LLM 流程。

### 5.3 Footer 状态指示

右下角显示 Agent 连接状态：

| 状态 | 图标 | 颜色 |
|------|------|------|
| 离线 | ⚫ | 灰色 |
| 连接中 | 🟡 | 黄色 |
| 就绪 | 🟢 | 绿色 |
| 运行中 | 🔵 | 蓝色 |
| 错误 | 🔴 | 红色 |

---

## 6. 配置

```ts
// frontend/src/app/runtime/config.ts
export const AGENT_WS_URL =
  import.meta.env.VITE_AGENT_WS_URL || 'ws://127.0.0.1:7765/ws'
```

环境变量：
```bash
VITE_AGENT_WS_URL=ws://localhost:7765/ws
```

---

## 7. 测试

### 7.1 Mock Server

```bash
cd frontend/src/app/agent/mock
python mock_agent_server.py
```

支持 `arm.home`（500ms 延迟）和 `arm.move`（1.5s 带进度更新）。

### 7.2 单元测试

| 文件 | 测试内容 |
|------|----------|
| `agent-client.test.ts` | connect / execute / timeout / reconnect |
| `agent-machine.test.ts` | 6 个状态流转场景 |
| `capability-registry.test.ts` | 参数验证 |

### 7.3 手动验证

1. 启动 mock server
2. 打开前端，确认 Footer 显示 🟢 Agent 就绪
3. 输入 `/arm home`，MessageList 显示右侧 🤖 指令
4. 观察左侧 ✅ 归位完成 系统消息
5. 输入 `/arm move 100 50 20`，观察进度日志和状态更新

---

## 8. 未来扩展

### 8.1 翻译层（预留）

`frontend/src/app/agent/bridge/README.md`

将 LLM 输出解析为 capability intent：

```
用户语音: "机械臂回到初始位置"
LLM 输出: tool_call: arm.home
Bridge:   agent.execute('arm.home')
```

### 8.2 新增 Capability

在 `capability-registry.ts` 中扩展即可：

```ts
'gripper.open': { id: 'gripper.open', name: '打开夹爪', params: {} }
```

### 8.3 多机器人支持

`AgentClient` 可实例化多个，连接不同 `agentWsUrl`：

```ts
const armAgent = new AgentClient('ws://robot1:7765/ws')
const cameraAgent = new AgentClient('ws://camera:7765/ws')
```

---

## 9. 文件清单

```
frontend/src/app/agent/
├── index.ts                  # 统一导出
├── agent-protocol.ts         # 消息类型 + type guards
├── capability-registry.ts    # Capability 定义 + 验证
├── agent-client.ts           # WebSocket 封装
├── agent-context.ts          # 状态机 Context
├── agent-events.ts           # 事件常量
├── agent-machine.ts          # XState v5 状态机
├── agent-machine.test.ts     # 状态机测试
├── agent-client.test.ts      # 客户端测试
├── DESIGN.md                 # 本文档
├── bridge/
│   └── README.md             # 翻译层预留文档
└── mock/
    ├── mock_agent_server.py  # Python mock server
    └── README.md             # Mock 使用说明
```

---

## 10. 安全考虑

- **物理动作确认**：所有 `arm.move` 等物理操作未来应加入确认对话框
- **紧急停止**：预留 `agent.cancel(requestId)` 接口，可中断执行
- **超时保护**：execute 默认 30s 超时，防止挂起
- **错误降级**：Agent 连接失败不影响主语音聊天流程

# WsStatus

## 功能描述

WebSocket 连接状态显示组件。

## 状态值

| 状态 | 显示文本 | 含义 |
|------|----------|------|
| `connected` | "WS: ✓" | 已连接 |
| `connecting` | "WS: ↻" | 连接中 |
| `disconnected` | "WS: ✗" | 已断开 |
| `reconnecting` | "WS: ↻" | 重连中 |
| `error` | "WS: !" | 连接错误 |

## 核心方法

| 方法 | 描述 |
|------|------|
| `setStatus(state: string)` | 更新显示状态 |

## 使用场景

- 监控 WebSocket 连接健康状态
- 排查连接问题
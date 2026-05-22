# StatusBar

## 功能描述

调试用状态栏容器组件。整合多个状态显示子组件，提供一站式的系统状态监控。

## 核心结构

```
StatusBar
├── WsStatus (WebSocket状态)
├── ConversationState (对话状态)
├── AudioState (音频状态)
├── MicPermission (麦克风权限)
└── ReconnectCount (重连次数)
```

## 子组件

| 组件 | 描述 |
|------|------|
| `WsStatus` | WebSocket 连接状态 |
| `ConversationState` | 语音状态机当前状态 |
| `AudioState` | 音频录制/播放状态 |
| `ReconnectCount` | WebSocket 重连次数 |
| `MicPermission` | 麦克风权限状态 |

## 数据绑定

```typescript
// 语音状态机订阅
voiceActor.subscribe(snapshot => {
  conversationState.setState(snapshot.value)
  audioState.setState(snapshot.value)
})

// WebSocket 状态订阅
wsClient.onStateChange(state => {
  wsStatus.setStatus(state.state)
  reconnectCount.setCount(state.reconnectAttempt)
})

// 诊断信息订阅
diagnosticsCollector.snapshot() => micPermission.setPermission()
```

## 使用场景

- 开发调试时显示系统各组件状态
- 排查连接问题
- 监控语音对话流程

## CSS 类名

| 类名 | 描述 |
|------|------|
| `status-bar` | 状态栏容器根类 |
| `status-bar__container` | 内容包装器 |
| `status-divider` | 分隔符（竖线） |
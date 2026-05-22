# MessageList

## 功能描述

消息列表容器组件。管理多个 MessageItem 组件的渲染，负责消息的增删改和自动滚动。

## 核心结构

```
MessageList (data-testid="transcript")
├── MessageItem[]
└── TypingIndicator (打字动画)
```

## 核心属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `element` | HTMLElement | 组件根元素 |
| `messageItems` | Map<string, MessageItem> | 消息 ID 到组件的映射 |
| `typingIndicator` | TypingIndicator | 打字动画组件 |

## 核心方法

| 方法 | 描述 |
|------|------|
| `getElement()` | 返回组件根元素 |

## 数据流

1. 订阅 `chatStore` 状态变化
2. 当 messages 数组变化时，调用 `update()`
3. `update()` 比对当前渲染的 ID 和新的 ID，添加/删除/更新 MessageItem
4. TypingIndicator 根据 `chatStore.isStreaming` 显示/隐藏
5. 自动滚动到底部

## 自动滚动

使用 `requestAnimationFrame` 在下一帧执行滚动，确保 DOM 更新完成后滚动到最新消息：

```typescript
private scrollToBottom(): void {
  requestAnimationFrame(() => {
    const parent = this.element.parentElement
    if (parent) {
      parent.scrollTop = parent.scrollHeight
    }
  })
}
```

## 使用场景

- 显示对话历史消息
- 流式输出时动态添加/更新消息
- 显示助手正在输入的动画
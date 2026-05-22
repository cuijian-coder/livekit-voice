# MessageItem

## 功能描述

单条聊天消息的显示组件。展示消息内容、发送者头像和时间戳。

## 核心结构

```
MessageItem
├── avatar (头像)
│   └── textContent: "U" (user) 或 "A" (assistant)
├── wrapper
│   ├── content (消息内容)
│   └── time (时间戳)
```

## 核心属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `element` | HTMLElement | 组件根元素 |

## 构造参数

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}
```

## 核心方法

| 方法 | 描述 |
|------|------|
| `getElement()` | 返回组件根元素 |
| `updateContent(content: string)` | 更新消息内容 |

## CSS 类名

| 类名 | 描述 |
|------|------|
| `message` | 消息容器根类 |
| `message--user` | 用户消息样式变体 |
| `message--assistant` | 助手消息样式变体 |
| `message__avatar` | 头像容器 |
| `message__content` | 消息内容 |
| `message__wrapper` | 内容+时间包装器 |
| `message__time` | 时间戳 |

## 使用场景

- 在 MessageList 中渲染单条消息
- 流式输出时动态更新内容
# TypingIndicator

## 功能描述

打字动画指示器。显示三个跳动的点，表示助手正在生成回复。

## 核心结构

```
TypingIndicator
└── dot (×3)
```

## CSS 类名

| 类名 | 描述 |
|------|------|
| `typing-indicator` | 容器根类 |
| `typing-indicator__dot` | 单个点样式 |

## 外观特征

- 3 个等间距的圆点
- 默认隐藏 (`display: none`)
- 当 `chatStore.isStreaming === true` 时显示

## 使用场景

- 助手正在流式输出 LLM 回复时显示
- 等待助手响应时显示
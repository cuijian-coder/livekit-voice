# Known Issues

## 当前已知问题

### 1. 音量可视化效果待优化

**问题描述**: 声波动画变化可能不够明显

**当前状态**: 已实现动态高度，使用正弦波计算

**参考代码**:
```typescript
// InputBar.ts - updateRecordingVisualization
const wave = Math.sin(normalized * Math.PI * 2 + phase * Math.PI * 2)
```

### 2. 线性状态机不支持并行状态

**问题描述**: 使用 XState parallel states 时遇到 target 路径问题

**当前方案**: 使用线性状态机

**影响**: 无法同时处理 audio + conversation 独立状态

**后续**: 如需 barge-in 等功能，需要重新设计为 parallel states

### 3. 音频数据未发送到后端 ✅ 已修复

**问题描述**: MediaRecorder 录制的数据只存在于内存中

**修复状态**: 前端通过 WebSocket 发送 binary PCM 帧，后端实时接收并送入 ASR

### 4. 流式响应未完整实现 ✅ 已修复

**问题描述**: mockAI 有流式响应实现，但前端未处理 llm.token 事件

**修复状态**: `message-router.ts` 已处理 `llm.token`，`chatStore` 实时更新消息内容

### 5. TTS 音频播放未实现 ✅ 已修复

**问题描述**: 后端会返回 TTS 音频，但前端无播放逻辑

**修复状态**: `ttsPlayback` 已实现，支持流式 chunk 播放和中断

## 设计限制

### 1. 无持久化

- 日志仅保存在内存中 (200 条)
- 时间线仅保存在内存中 (100 条)
- 刷新页面后清空

### 2. 无 Remote Telemetry

- 当前仅支持 console 输出
- 无 Sentry/OpenTelemetry 集成

### 3. 测试覆盖

- Selectors 已覆盖 ✅
- Voice Machine 已覆盖 ✅
- Logger/Diagnostics 已覆盖 ✅
- **UI 组件已部分覆盖** (InputBar 单元测试 7 个 ✅)
- **集成测试已覆盖** (Playwright 集成测试：真实 ASR+LLM+TTS ✅)
- **Mock E2E 测试已覆盖** (27 个 Playwright 测试 ✅)

## 技术债

| 项目 | 说明 | 优先级 | 状态 |
|------|------|--------|------|
| Parallel states | 未来需要支持 barge-in 时重构 | 中 | ⏳ |
| Audio Playback | TTS 音频播放 | 高 | ✅ 已完成 |
| Streaming UI | llm.token 事件处理 | 高 | ✅ 已完成 |
| E2E Tests | Playwright 测试 | 低 | ✅ 已完成 |

## 已验证的正确行为

✅ 状态机状态转换正确 (idle→listening→thinking→speaking)
✅ 事件名称已统一 (session.start, audio.commit, interrupt.request)
✅ Logger 正确输出日志
✅ Validation 正确验证状态合法性
✅ 单元测试 170 个全部通过
✅ 录音功能正常工作 (MediaRecorder)
✅ 消息列表正常工作
✅ 主题切换正常工作

## 注意事项

1. **不要在生产环境使用 console.log** - 已通过 Logger 系统统一管理
2. **状态机使用线性设计** - 如需并行状态需重构
3. **测试在 Node 环境运行** - 浏览器 API 相关测试无法运行
4. **事件名称已更新** - 使用新名称 (session.start 而非 START_RECORDING)
# Known Issues

## 当前已知问题

### 1. 音量可视化效果不明显

**问题描述**: 声波动画变化不够明显，用户反馈"没反应"

**可能原因**:
- 音量级别计算方式不够敏感
- 正弦波相位计算导致振幅过低

**当前状态**: 已实现动态高度，但效果待优化

**参考代码**:
```typescript
// InputBar.ts - updateRecordingVisualization
const wave = Math.sin(normalized * Math.PI * 2 + phase * Math.PI * 2)
```

### 2. 线性状态机不支持并行状态

**问题描述**: 之前尝试使用 XState parallel states 时遇到 target 路径问题

**原因**: XState v5 中 parallel states 的 target 语法不同

**当前方案**: 使用线性状态机 (简单但有限制)

**影响**: 无法同时处理 audio + conversation 独立状态

**后续**: 如需 barge-in 等功能，需要重新设计为 parallel states

### 3. 音频数据未发送到后端

**问题描述**: MediaRecorder 录制的数据只存在于内存中

**当前状态**: 仅用于触发状态转换，无实际音频流转

**需要**: 接入 LiveKit 后端服务

### 4. 状态机缺少 Audio 事件处理

**问题描述**: machine 中定义了 ASR_PARTIAL 等事件，但没有实际处理逻辑

**需要**: 实现 ASR 事件处理，更新 partialTranscript

## 设计限制

### 1. 无持久化

- 日志仅保存在内存中 (200 条)
- 时间线仅保存在内存中 (100 条)
- 刷新页面后清空

### 2. 无 Remote Telemetry

- 当前仅支持 console 输出
- 无 Sentry/OpenTelemetry 集成

### 3. 无 Replay System

- 无法回放调试
- 需要手动复现问题

### 4. 测试覆盖不完整

- Selectors 已覆盖 ✅
- Voice Machine 已覆盖 ✅
- Logger/Diagnostics 已覆盖 ✅
- **UI 组件未覆盖** (InputBar 等)
- **集成测试未覆盖**

## 技术债

| 项目 | 说明 | 优先级 |
|------|------|--------|
| Parallel states | 未来需要支持 barge-in 时重构 | 中 |
| Audio Playback | TTS 音频播放未实现 | 高 |
| Mock Services | 无 mock ASR/LLM/TTS 用于调试 | 中 |
| E2E Tests | 无 Playwright 测试 | 低 |

## 已验证的正确行为

✅ 状态机状态转换正确 (idle→listening→thinking)  
✅ Logger 正确输出日志  
✅ Validation 正确验证状态合法性  
✅ 单元测试覆盖核心模块  
✅ 录音功能正常工作 (MediaRecorder)  
✅ 按钮样式正确切换  
✅ Git 提交正常

## 注意事项

1. **不要在生产环境使用 console.log** - 已通过 Logger 系统统一管理
2. **状态机使用线性设计** - 如需并行状态需重构
3. **测试在 Node 环境运行** - 浏览器 API 相关测试无法运行

## 临时方案记录

- **音量计算**: 简单 RMS 计算，可能不够精确
- **声波动画**: 使用正弦波，可调整参数改善效果
- **按钮状态**: 基于 selector 派生，非直接映射 machine 状态
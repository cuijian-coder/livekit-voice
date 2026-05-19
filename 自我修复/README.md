# 自我修复 (Self-Healing)

## 目标

建立 AI 可理解的统一命令入口，让 AI 能够：

```bash
pnpm doctor          # 自动诊断系统健康状态
pnpm test:e2e        # 运行 E2E 测试
pnpm test:run        # 运行单元测试
```

AI 根据 exit code 和输出自动判断：
- 通过/失败
- 哪个步骤挂了
- 具体的错误原因

---

## 目录结构

```
自我修复/
├── README.md                    # 本文件
├── doctor.ts                    # 健康检查脚本
├── playwright.config.ts         # E2E 配置
├── e2e/                         # E2E 测试
│   ├── audio-runtime.spec.ts    # 音频运行时检查
│   └── conversation-flow.spec.ts # 对话流程测试
└── commands.md                  # 命令参考文档
```

---

## 核心命令

### pnpm doctor

健康检查脚本，验证本地运行环境：

```bash
$ pnpm doctor

Running doctor checks...

✓ frontend (36ms)
✓ backend (5ms)
✓ websocket (13ms)
✓ qwen-api-key set
✓ backend-port configured
✓ node version (v24.15.0)

status: pass
duration: 55ms
artifacts/doctor-report.json written
```

**检查项：**

| 检查项 | 方法 | 超时 | 通过条件 |
|--------|------|------|----------|
| frontend | HTTP GET localhost:5173 | 2000ms | 200 OK |
| backend | HTTP GET localhost:3000/health | 2000ms | 200 OK |
| websocket | Connect ws://localhost:3000/ws | 3000ms | 连接成功 |
| qwen-api-key | 检查环境变量 | 100ms | 已设置且非空 |
| backend-port | 检查 PORT 环境变量 | 100ms | 有效端口号 |
| node-version | 检查 process.version | 100ms | >= 20.0.0 |

**输出：**
- 控制台：可读的结果
- JSON：`artifacts/doctor-report.json`
- Exit code：0 = 通过，1 = 失败

### pnpm test:e2e

运行 Playwright E2E 测试：

```bash
$ pnpm test:e2e

  ✓ audio-runtime.spec.ts
  ✓ conversation-flow.spec.ts

  2 tests passed (2)
```

### pnpm test:run

运行所有单元测试：

```bash
$ pnpm test:run

  Test Files  15 passed (15)
       Tests  186 passed (186)
```

---

## 快速验证

```bash
# 1. 运行健康检查
pnpm doctor

# 2. 如果通过，运行单元测试
pnpm test:run

# 3. 如果通过，运行 E2E 测试
pnpm test:e2e

# 完整流程
pnpm doctor && pnpm test:run && pnpm test:e2e
```

---

## 扩展检查项

未来可添加的检查：

- [ ] 音频设备可用性
- [ ] 麦克风权限
- [ ] AI Provider API 连通性 (需要真实请求)
- [ ] 会话状态一致性
- [ ] 内存/CPU 使用率

---

## AI 使用场景

### 场景 1: 系统启动前检查

```bash
# AI 在执行任何操作前先检查
pnpm doctor
if [ $? -ne 0 ]; then
  cat artifacts/doctor-report.json
  exit 1
fi
```

### 场景 2: 测试失败后诊断

```bash
# 测试失败时，AI 查看详细报告
pnpm doctor
cat artifacts/doctor-report.json
# 根据失败的检查项定位问题
```

### 场景 3: CI/CD 集成

```yaml
# .github/workflows/test.yml
- name: Doctor Check
  run: pnpm doctor

- name: Unit Tests
  run: pnpm test:run

- name: E2E Tests
  run: pnpm test:e2e
```

---

## 注意事项

1. **不要调用真实 AI API**：doctor.ts 只验证环境配置，不发送真实请求
2. **超时要短**：所有检查应在 5 秒内完成
3. **确定性结果**：无重试，无随机性
4. **清晰的错误信息**：每个失败都要有明确的 reason
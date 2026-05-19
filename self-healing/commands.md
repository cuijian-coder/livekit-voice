# 命令参考

## 常用命令

| 命令 | 描述 | Exit Code |
|------|------|-----------|
| `pnpm doctor` | 运行健康检查 | 0=通过, 1=失败 |
| `pnpm test` | 运行单元测试 (watch) | 0=通过, 1=失败 |
| `pnpm test:run` | 运行单元测试 (单次) | 0=通过, 1=失败 |
| `pnpm test:e2e` | 运行 Playwright E2E | 0=通过, 1=失败 |
| `pnpm dev` | 启动开发服务器 | - |
| `pnpm build` | 构建项目 | 0=通过 |
| `pnpm typecheck` | TypeScript 类型检查 | 0=通过, 1=失败 |
| `pnpm lint` | 代码规范检查 | 0=通过 |

## Turbo 命令

```bash
# 在根目录运行
pnpm turbo <task> --filter=<package>
```

示例：
```bash
pnpm turbo typecheck --filter=frontend
pnpm turbo test --filter=backend
pnpm turbo dev --filter=frontend
```

## Doctor 检查项

```
✓ frontend         HTTP localhost:5173 -> 200 OK
✓ backend          HTTP localhost:3000/health -> 200 OK
✓ websocket        ws://localhost:3000/ws -> 连接成功
✓ qwen-api-key     env QWEN_API_KEY 非空
✓ backend-port     env PORT 有效 (1024-65535)
✓ node-version     process.version >= 20.0.0
```

## 完整验证流程

```bash
# 1. 健康检查
pnpm doctor
# 查看详细报告
cat artifacts/doctor-report.json

# 2. 单元测试
pnpm test:run

# 3. E2E 测试
pnpm test:e2e

# 一行执行
pnpm doctor && pnpm test:run && pnpm test:e2e
```

## 调试

```bash
# 查看 backend 日志
tail -f /tmp/server.log

# 查看 frontend 日志
tail -f /tmp/frontend.log

# 检查进程
ps aux | grep -E "tsx|node|vite" | grep -v grep

# 直接运行 doctor
cd /home/jiancui2026/projects/livekit-voice
npx tsx scripts/doctor.ts
```

## 常见问题

### Doctor 显示 frontend 失败

```bash
# 检查 frontend 是否运行
curl -s http://localhost:5173 > /dev/null && echo "OK" || echo "Not running"

# 重启 frontend
cd frontend && pnpm dev
```

### Doctor 显示 backend 失败

```bash
# 检查 backend 是否运行
curl -s http://localhost:3000/health

# 重启 backend
cd backend && node --import tsx src/main.ts
```

### WebSocket 连接失败

```bash
# 检查 backend WebSocket 端点
# ws://localhost:3000/ws 应该可以连接

# 查看 backend 是否正常
curl -s http://localhost:3000/health
```

## Exit Code 参考

| Code | 含义 |
|------|------|
| 0 | 成功，所有检查通过 |
| 1 | 失败，至少一项检查未通过 |
| 2 | TypeScript 编译错误 |
| 3 | ESLint 检查失败 |
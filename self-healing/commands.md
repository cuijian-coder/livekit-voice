# Command Reference

## Common Commands

| Command | Description | Exit Code |
|---------|-------------|-----------|
| `pnpm doctor` | Run health check | 0=pass, 1=fail |
| `pnpm test` | Run unit tests (watch) | 0=pass, 1=fail |
| `pnpm test:run` | Run unit tests (single) | 0=pass, 1=fail |
| `pnpm test:e2e` | Run Playwright E2E | 0=pass, 1=fail |
| `pnpm dev` | Start dev servers | - |
| `pnpm build` | Build project | 0=pass |
| `pnpm typecheck` | TypeScript check | 0=pass, 1=fail |
| `pnpm lint` | Lint check | 0=pass |

## Turbo Commands

```bash
# Run at root with turbo
pnpm turbo <task> --filter=<package>
```

Examples:
```bash
pnpm turbo typecheck --filter=frontend
pnpm turbo test --filter=backend
pnpm turbo dev --filter=frontend
```

## Doctor Checks

```
✓ frontend         HTTP localhost:5173 -> 200 OK
✓ backend          HTTP localhost:3000/health -> 200 OK
✓ websocket        ws://localhost:3000/ws -> Connected
✓ qwen-api-key     env QWEN_API_KEY non-empty
✓ backend-port     env PORT valid (1024-65535)
✓ node-version     process.version >= 20.0.0
```

## Full Verification Pipeline

```bash
# 1. Health check
pnpm doctor
# View detailed report
cat artifacts/doctor-report.json

# 2. Unit tests
pnpm test:run

# 3. E2E tests
pnpm test:e2e

# One-liner
pnpm doctor && pnpm test:run && pnpm test:e2e
```

## Debugging

```bash
# View backend logs
tail -f /tmp/server.log

# View frontend logs
tail -f /tmp/frontend.log

# Check processes
ps aux | grep -E "tsx|node|vite" | grep -v grep

# Run doctor directly
cd /home/jiancui2026/projects/livekit-voice
npx tsx self-healing/doctor.ts
```

## Common Issues

### Doctor shows frontend failed

```bash
# Check if frontend is running
curl -s http://localhost:5173 > /dev/null && echo "OK" || echo "Not running"

# Restart frontend
cd frontend && pnpm dev
```

### Doctor shows backend failed

```bash
# Check backend
curl -s http://localhost:3000/health

# Restart backend
cd backend && node --import tsx src/main.ts
```

### WebSocket connection failed

```bash
# Verify backend WebSocket endpoint
# ws://localhost:3000/ws should connect

# Check backend is healthy
curl -s http://localhost:3000/health
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success, all checks passed |
| 1 | Failure, at least one check failed |
| 2 | TypeScript compilation error |
| 3 | ESLint check failed |
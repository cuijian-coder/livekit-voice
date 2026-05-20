# Self-Healing

## Goal

Establish an AI-understandable unified command entry point, enabling AI to:

```bash
pnpm doctor          # Auto-diagnose system health
pnpm test:e2e        # Run E2E tests
pnpm test:run        # Run unit tests
```

AI determines automatically based on exit code and output:
- Pass/fail
- Which step failed
- Specific error reason

---

## Directory Structure

```
self-healing/
├── turbo.json                    # Turbo configuration
├── README.md                     # This file
├── doctor.ts                     # Health check script
├── playwright.config.ts          # E2E configuration
├── commands.md                   # Command reference
└── e2e/                          # E2E tests
    ├── audio-runtime.spec.ts     # Audio runtime checks
    └── conversation-flow.spec.ts # Conversation flow tests
```

---

## Core Commands

### pnpm doctor

Health check script that validates local runtime environment:

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

**Checks:**

| Check | Method | Timeout | Pass Criteria |
|-------|--------|---------|---------------|
| frontend | HTTP GET localhost:5173 | 2000ms | 200 OK |
| backend | HTTP GET localhost:3000/health | 2000ms | 200 OK |
| websocket | Connect ws://localhost:3000/ws | 3000ms | Connected |
| qwen-api-key | Check env variable | 100ms | Set and non-empty |
| backend-port | Check PORT env variable | 100ms | Valid port number |
| node-version | Check process.version | 100ms | >= 20.0.0 |

**Output:**
- Console: Human-readable results
- JSON: `artifacts/doctor-report.json`
- Exit code: 0 = pass, 1 = fail

### pnpm test:e2e

Run Playwright E2E tests:

```bash
$ pnpm test:e2e

  ✓ audio-runtime.spec.ts
  ✓ conversation-flow.spec.ts

  2 tests passed (2)
```

### pnpm test:run

Run all unit tests:

```bash
$ pnpm test:run

  Test Files  15 passed (15)
       Tests  186 passed (186)
```

---

## Quick Verification

```bash
# 1. Run health check
pnpm doctor

# 2. If pass, run unit tests
pnpm test:run

# 3. If pass, run E2E tests
pnpm test:e2e

# Full pipeline
pnpm doctor && pnpm test:run && pnpm test:e2e
```

---

## Future Checks

Potential additions:

- [ ] Audio device availability
- [ ] Microphone permission
- [ ] AI Provider API connectivity (requires real requests)
- [ ] Session state consistency
- [ ] Memory/CPU usage

---

## AI Usage Scenarios

### Scenario 1: Pre-flight check before system start

```bash
# AI checks before any operation
pnpm doctor
if [ $? -ne 0 ]; then
  cat artifacts/doctor-report.json
  exit 1
fi
```

### Scenario 2: Diagnose after test failure

```bash
# AI views detailed report on failure
pnpm doctor
cat artifacts/doctor-report.json
# Locate problem based on failed checks
```

### Scenario 3: CI/CD Integration

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

## Constraints

1. **Do NOT call real AI APIs**: doctor.ts only validates environment config, no real requests
2. **Short timeouts**: All checks should complete within 5 seconds
3. **Deterministic results**: No retries, no randomness
4. **Clear error messages**: Each failure must have a clear reason

---

## UI Machine Observable (testid Coverage)

All critical UI elements have stable `data-testid` attributes for Playwright testing.

### testid Reference

| testid | Element | Data Source |
|--------|---------|-------------|
| `ws-status` | WebSocket connection status | wsClient.getState().state |
| `conversation-state` | Conversation state | voiceActor.getSnapshot().value |
| `audio-state` | Audio state (recording/playing) | Derived from voiceActor state |
| `reconnect-count` | Reconnection attempts | wsClient.getState().reconnectAttempt |
| `push-to-talk` | Push-to-talk button | InputBar actionButton |
| `text-input` | Text input textarea | InputBar textarea |
| `transcript` | Message list / transcript | MessageList element |

### Playwright Usage

```typescript
// Read UI display state
await expect(page.getByTestId('ws-status')).toHaveText('connected')
await expect(page.getByTestId('conversation-state')).toHaveText('speaking')

// Read machine internal state
const debug = await page.evaluate(() => window.__VOICE_DEBUG__)
expect(debug.conversation.state).toBe('speaking')

// Element interaction
await page.getByTestId('push-to-talk').click()
```

### Architecture

```
XState Machine (voiceActor)
    ↓
DiagnosticsCollector (收集/snapshot)
    ↓
window.__VOICE_DEBUG__ (Playwright 读取)
    ↓
StatusBar (实时 UI 状态显示)
    ↓
voiceActor.subscribe() + wsClient.onStateChange()
```

### Debug Endpoint

```bash
curl http://localhost:3000/debug/runtime
```

Returns machine-parseable JSON snapshot of runtime state.

---

## Runtime Diagnostics Panel

### GET /debug/runtime

Returns:

```json
{
  "websocket": { "connected": false, "reconnectCount": 0 },
  "audio": { "recording": false, "playing": false },
  "conversation": { "state": "idle", "turnId": "" },
  "recentEvents": [],
  "collectedAt": 1234567890,
  "totalEvents": 0
}
```

### window.__VOICE_DEBUG__

Frontend global object for Playwright inspection:

```typescript
window.__VOICE_DEBUG__ = {
  getSnapshot: () => diagnosticsCollector.snapshot(),
  getEvents: () => diagnosticsCollector.getEvents(),
  exportState: () => diagnosticsCollector.exportState()
}
```
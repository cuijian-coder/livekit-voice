# Self-Healing

## Goal

Establish an AI-understandable unified command entry point, enabling AI to:

```bash
pnpm doctor          # Auto-diagnose system health
pnpm validate        # Full pipeline: typecheck → unit → mocked → real-browser → smoke
pnpm test:run        # Run unit tests
pnpm test:e2e        # Run all E2E tests
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
├── validate.sh                   # Full validation pipeline
├── playwright.config.ts          # E2E configuration
├── assert.ts                     # Runtime assertions
├── diagnostics/
│   ├── collector.ts              # DiagnosticsCollector
│   └── types.ts                  # Type definitions
└── e2e/                          # E2E tests (3 layers)
    ├── mocked/                   # Deterministic CI tests
    ├── real-browser/             # Real browser behavior tests
    └── smoke/                    # Deployment sanity checks
```

---

## Test Layers

### mocked/ (27 tests)
Deterministic tests for CI fast feedback. No real network calls.

- `push-to-talk.spec.ts`
- `interrupt.spec.ts`
- `reconnect.spec.ts`
- `streaming.spec.ts`
- `websocket.spec.ts`
- `audio-runtime.spec.ts`
- `conversation-flow.spec.ts`

### real-browser/ (12 tests)
Real browser behavior validation with fake backend.

- `permissions.spec.ts` - microphone permissions
- `audio-context.spec.ts` - AudioContext behavior
- `media-devices.spec.ts` - mediaDevices availability
- `visibility.spec.ts` - visibility API

### smoke/ (7 tests)
Deployment sanity checks.

- `health.spec.ts` - backend health endpoints
- `websocket.spec.ts` - WebSocket connectivity
- `diagnostics.spec.ts` - diagnostics availability

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

### pnpm validate

Full validation pipeline:

```bash
$ pnpm validate

=== Step 1: Typecheck ===
=== Step 2: Unit Tests ===
=== Step 3: Mocked E2E (CI fast) ===
=== Step 4: Real Browser E2E ===
=== Step 5: Smoke Tests ===
=== All Checks Passed ===
```

### pnpm test:e2e

Run all Playwright E2E tests (mocked + real-browser + smoke):

```bash
$ pnpm test:e2e

  46 passed, 1 skipped (52s)
```

---

## Error Classification

Structured error types for AI debugging:

```typescript
ErrorType = {
  Permission,  // microphone denied, security error
  Device,      // no microphone, device not found
  Websocket,   // connection failed, disconnected
  Network,     // request timeout, rate limit
  Logic        // application logic error
}

ErrorCodes = {
  MIC001: 'MicrophonePermissionDenied',   // NotAllowedError
  MIC002: 'MicrophoneDeviceNotFound',     // NotFoundError
  WS001: 'WebsocketConnectionFailed',
  WS002: 'WebsocketDisconnected',
  ASR001: 'AsrStreamError',
  LLM001: 'LlmGenerationError',
  TTS001: 'TtsSynthesisError',
  TTS002: 'TtsPlaybackError',
}
```

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
| `mic-permission` | Microphone permission state | navigator.permissions |
| `tts-status` | TTS playback state | Derived from voiceActor state |

### Playwright Usage

```typescript
// Read UI display state
await expect(page.getByTestId('ws-status')).toContainText('connected')
await expect(page.getByTestId('conversation-state')).toContainText('speaking')

// Read machine internal state
const debug = await page.evaluate(() => window.__VOICE_DEBUG__)
expect(debug.conversation.state).toBe('speaking')
expect(debug.permissions.microphone).toBe('granted')

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

---

## Runtime Diagnostics

### GET /debug/runtime

Backend endpoint returning machine-parseable JSON:

```json
{
  "permissions": { "microphone": "granted" },
  "websocket": { "connected": true, "reconnectCount": 0 },
  "audio": { "recording": false, "playing": false },
  "conversation": { "state": "idle", "turnId": "" },
  "environment": {
    "secureContext": true,
    "mediaDevicesSupported": true,
    "audioContextState": "running",
    "userAgent": "..."
  },
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

---

## Constraints

1. **Do NOT call real AI APIs in CI**: mocked tests use fake backend
2. **CI does NOT run real TTS**: real-browser tests use fake TTS chunks
3. **Smoke tests do NOT add unnecessary flakiness**: simple health checks only
4. **Short timeouts**: All checks should complete within 5 seconds
5. **Deterministic results**: No retries, no randomness
6. **Clear error messages**: Each failure must have a clear reason

---

## AI Usage Scenarios

### Scenario 1: Pre-flight check before system start

```bash
pnpm doctor
if [ $? -ne 0 ]; then
  cat artifacts/doctor-report.json
  exit 1
fi
```

### Scenario 2: Full validation before PR

```bash
pnpm validate
# Or run layers individually for faster feedback
pnpm playwright test e2e/mocked/
pnpm playwright test e2e/real-browser/
pnpm playwright test e2e/smoke/
```

### Scenario 3: Diagnose after test failure

```bash
# AI inspects Playwright traces/screenshots
# Reads window.__VOICE_DEBUG__
# Checks browser console logs
# Identifies root cause from error classification
```
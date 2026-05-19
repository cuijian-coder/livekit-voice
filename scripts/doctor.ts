#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'skip'
  duration?: number
  reason?: string
}

interface DoctorReport {
  status: 'pass' | 'fail'
  timestamp: string
  duration: number
  checks: CheckResult[]
}

const TIMEOUTS = {
  frontend: 2000,
  backend: 2000,
  websocket: 3000,
  env: 100,
  config: 100,
}

async function httpCheck(url: string, timeout: number): Promise<{ ok: boolean; duration: number; error?: string }> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(id)
    return { ok: response.ok, duration: Date.now() - start }
  } catch (err) {
    return { ok: false, duration: Date.now() - start, error: String(err) }
  }
}

async function websocketCheck(url: string, timeout: number): Promise<{ ok: boolean; duration: number; error?: string }> {
  const start = Date.now()
  return new Promise((resolve) => {
    const ws = new WebSocket(url)
    const timer = setTimeout(() => {
      ws.close()
      resolve({ ok: false, duration: Date.now() - start, error: 'timeout' })
    }, timeout)

    ws.onopen = () => {
      clearTimeout(timer)
      ws.close()
      resolve({ ok: true, duration: Date.now() - start })
    }

    ws.onerror = () => {
      clearTimeout(timer)
      ws.close()
      resolve({ ok: false, duration: Date.now() - start, error: 'connection failed' })
    }
  })
}

function checkEnvVar(name: string): { ok: boolean; reason?: string } {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    return { ok: false, reason: `${name} not set` }
  }
  return { ok: true }
}

function checkBackendPort(): { ok: boolean; reason?: string } {
  const port = process.env.PORT
  if (!port) {
    return { ok: false, reason: 'PORT not configured' }
  }
  const portNum = Number(port)
  if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
    return { ok: false, reason: `PORT invalid: ${port}` }
  }
  return { ok: true }
}

function checkNodeVersion(): { ok: boolean; reason?: string } {
  const version = process.version.slice(1)
  const [major] = version.split('.').map(Number)
  if (major < 20) {
    return { ok: false, reason: `Node ${version} < 20.0.0` }
  }
  return { ok: true }
}

async function main() {
  const startTime = Date.now()
  const checks: CheckResult[] = []

  console.log('Running doctor checks...\n')

  // Frontend check
  const frontendResult = await httpCheck('http://localhost:5173', TIMEOUTS.frontend)
  if (frontendResult.ok) {
    console.log(`✓ frontend (${frontendResult.duration}ms)`)
    checks.push({ name: 'frontend', status: 'pass', duration: frontendResult.duration })
  } else {
    console.log(`✗ frontend (${frontendResult.error || 'failed'})`)
    checks.push({ name: 'frontend', status: 'fail', duration: frontendResult.duration, reason: frontendResult.error })
  }

  // Backend check
  const backendResult = await httpCheck('http://localhost:3000/health', TIMEOUTS.backend)
  if (backendResult.ok) {
    console.log(`✓ backend (${backendResult.duration}ms)`)
    checks.push({ name: 'backend', status: 'pass', duration: backendResult.duration })
  } else {
    console.log(`✗ backend (${backendResult.error || 'failed'})`)
    checks.push({ name: 'backend', status: 'fail', duration: backendResult.duration, reason: backendResult.error })
  }

  // WebSocket check
  const wsResult = await websocketCheck('ws://localhost:3000/ws', TIMEOUTS.websocket)
  if (wsResult.ok) {
    console.log(`✓ websocket (${wsResult.duration}ms)`)
    checks.push({ name: 'websocket', status: 'pass', duration: wsResult.duration })
  } else {
    console.log(`✗ websocket (${wsResult.error || 'failed'})`)
    checks.push({ name: 'websocket', status: 'fail', duration: wsResult.duration, reason: wsResult.error })
  }

  // QWEN_API_KEY check
  const qwenCheck = checkEnvVar('QWEN_API_KEY')
  if (qwenCheck.ok) {
    console.log('✓ qwen-api-key set')
    checks.push({ name: 'qwen-api-key', status: 'pass' })
  } else {
    console.log(`✗ qwen-api-key (${qwenCheck.reason})`)
    checks.push({ name: 'qwen-api-key', status: 'fail', reason: qwenCheck.reason })
  }

  // Backend PORT check
  const portCheck = checkBackendPort()
  if (portCheck.ok) {
    console.log('✓ backend-port configured')
    checks.push({ name: 'backend-port', status: 'pass' })
  } else {
    console.log(`✗ backend-port (${portCheck.reason})`)
    checks.push({ name: 'backend-port', status: 'fail', reason: portCheck.reason })
  }

  // Node version check
  const nodeCheck = checkNodeVersion()
  if (nodeCheck.ok) {
    console.log(`✓ node version (${process.version})`)
    checks.push({ name: 'node-version', status: 'pass' })
  } else {
    console.log(`✗ node version (${nodeCheck.reason})`)
    checks.push({ name: 'node-version', status: 'fail', reason: nodeCheck.reason })
  }

  // Summary
  const duration = Date.now() - startTime
  const failedCount = checks.filter((c) => c.status === 'fail').length
  const overallStatus = failedCount === 0 ? 'pass' : 'fail'

  console.log(`\nstatus: ${overallStatus}`)
  console.log(`duration: ${duration}ms`)

  // Write JSON report
  const report: DoctorReport = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    duration,
    checks,
  }

  const artifactsDir = join(process.cwd(), 'artifacts')
  if (!existsSync(artifactsDir)) {
    mkdirSync(artifactsDir, { recursive: true })
  }

  const reportPath = join(artifactsDir, 'doctor-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`artifacts/doctor-report.json written`)

  // Exit with error code if any check failed
  process.exit(failedCount > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Doctor script error:', err)
  process.exit(1)
})
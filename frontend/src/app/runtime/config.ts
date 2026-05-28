import type { LogLevel } from '@livekit-voice/shared/logger'

function getElectronConfig() {
  const electron = (window as any).electronAPI
  return electron?.config || null
}

const ec = typeof window !== 'undefined' ? getElectronConfig() : null

export const API_BASE_URL = ec?.backend?.apiUrl
  || import.meta.env.VITE_API_URL
  || 'http://localhost:3000'

export const AGENT_WS_URL = ec?.agent?.wsUrl
  || import.meta.env.VITE_AGENT_WS_URL
  || 'ws://127.0.0.1:7765/ws'

export const AGENT_ENABLED = ec?.agent?.enabled
  ?? (import.meta.env.VITE_AGENT_ENABLED === 'true')

export const LOG_LEVEL: LogLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info'

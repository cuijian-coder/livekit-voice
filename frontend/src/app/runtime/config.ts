import type { LogLevel } from '@livekit-voice/shared/logger'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * Agent WebSocket endpoint for robot control.
 * Separate from the main voice chat WebSocket.
 */
export const AGENT_WS_URL = import.meta.env.VITE_AGENT_WS_URL || 'ws://127.0.0.1:7765/ws'

/**
 * Agent feature switch.
 * When enabled, the agent module auto-registers into the app via dynamic import.
 */
export const AGENT_ENABLED = import.meta.env.VITE_AGENT_ENABLED === 'true'

/**
 * Frontend logging level.
 * debug = everything (very noisy during audio recording)
 * info  = production default (filters pipeline pcm/vad/transport logs)
 * warn  = warnings and errors only
 * error = errors only
 */
export const LOG_LEVEL: LogLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info'
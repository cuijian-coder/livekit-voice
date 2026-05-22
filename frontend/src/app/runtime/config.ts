import type { LogLevel } from '@livekit-voice/shared/logger'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * Frontend logging level.
 * debug = everything (very noisy during audio recording)
 * info  = production default (filters pipeline pcm/vad/transport logs)
 * warn  = warnings and errors only
 * error = errors only
 */
export const LOG_LEVEL: LogLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info'
import type { LogLevel } from '@livekit-voice/shared/logger'
import config from '../../config.json'

export const API_BASE_URL = config.backend.apiUrl

export const AGENT_WS_URL = config.agent.wsUrl

export const AGENT_ENABLED = config.agent.enabled

export const LOG_LEVEL: LogLevel = config.logLevel as LogLevel

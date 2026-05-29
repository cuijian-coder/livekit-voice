import { CLIENT_EVENTS, SERVER_EVENTS } from '@livekit-voice/shared/protocol'
import type { ClientEventName, ServerEventName } from '@livekit-voice/shared/protocol'
import config from '../../../config.json'

export { CLIENT_EVENTS, SERVER_EVENTS }
export type { ClientEventName, ServerEventName }

export interface TransportConfig {
  url: string
  reconnect: boolean
  reconnectIntervalMs: number
  maxReconnectAttempts: number
}

export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  url: config.backend.wsUrl,
  reconnect: true,
  reconnectIntervalMs: 1000,
  maxReconnectAttempts: 5,
}

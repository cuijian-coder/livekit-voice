import { CLIENT_EVENTS, SERVER_EVENTS } from '@livekit-voice/shared/protocol'
import type { ClientEventName, ServerEventName } from '@livekit-voice/shared/protocol'

export { CLIENT_EVENTS, SERVER_EVENTS }
export type { ClientEventName, ServerEventName }

function resolveDefaultWsUrl(): string {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws`
  }
  // fallback for SSR / test environments
  return 'ws://localhost:3000/ws'
}

export interface TransportConfig {
  url: string
  reconnect: boolean
  reconnectIntervalMs: number
  maxReconnectAttempts: number
}

export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  url: resolveDefaultWsUrl(),
  reconnect: true,
  reconnectIntervalMs: 1000,
  maxReconnectAttempts: 5,
}
export type TransportState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

export interface TransportStateInfo {
  state: TransportState
  error?: string
  reconnectAttempt?: number
  lastConnectedAt?: number
}

export function createInitialTransportState(): TransportStateInfo {
  return {
    state: 'disconnected',
  }
}
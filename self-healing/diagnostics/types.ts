export type DiagnosticSource =
  | 'audio.recorder'
  | 'audio.playback'
  | 'transport.websocket'
  | 'conversation.machine'
  | 'asr'
  | 'llm'
  | 'tts'

export type DiagnosticEvent = {
  id: string
  timestamp: number
  source: DiagnosticSource
  type: string
  turnId?: string
  durationMs?: number
  metadata?: Record<string, unknown>
}

export type WebsocketDiagnostics = {
  connected: boolean
  reconnectCount: number
  lastConnectedAt?: number
}

export type AudioDiagnostics = {
  recording: boolean
  playing: boolean
}

export type ConversationDiagnostics = {
  state: string
  turnId: string
}

export type DiagnosticsSnapshot = {
  websocket: WebsocketDiagnostics
  audio: AudioDiagnostics
  conversation: ConversationDiagnostics
  recentEvents: DiagnosticEvent[]
  collectedAt: number
  totalEvents: number
}
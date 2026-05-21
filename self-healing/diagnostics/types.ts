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
  lastError?: string
}

export type AudioDiagnostics = {
  recording: boolean
  playing: boolean
  error?: string
}

export type ConversationDiagnostics = {
  state: string
  turnId: string
  errorType?: string
}

export type PermissionDiagnostics = {
  microphone: 'granted' | 'denied' | 'prompt' | 'unknown'
}

export type EnvironmentDiagnostics = {
  secureContext: boolean
  mediaDevicesSupported: boolean
  audioContextState: string
  userAgent: string
}

export type DiagnosticsSnapshot = {
  permissions: PermissionDiagnostics
  websocket: WebsocketDiagnostics
  audio: AudioDiagnostics
  conversation: ConversationDiagnostics
  environment: EnvironmentDiagnostics
  recentEvents: DiagnosticEvent[]
  collectedAt: number
  totalEvents: number
}
import { RingBuffer } from '../../packages/shared/ring-buffer'
import type { DiagnosticEvent, DiagnosticsSnapshot, WebsocketDiagnostics, AudioDiagnostics, ConversationDiagnostics } from './types'

export class DiagnosticsCollector {
  private events: RingBuffer<DiagnosticEvent>
  private websocket: WebsocketDiagnostics = { connected: false, reconnectCount: 0 }
  private audio: AudioDiagnostics = { recording: false, playing: false }
  private conversation: ConversationDiagnostics = { state: 'idle', turnId: '' }
  private totalEvents = 0

  constructor(maxEvents = 50) {
    this.events = new RingBuffer<DiagnosticEvent>(maxEvents)
  }

  add(event: Omit<DiagnosticEvent, 'id' | 'timestamp'>): void {
    const full: DiagnosticEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    }
    this.events.push(full)
    this.totalEvents++
  }

  updateState(state: {
    websocket?: Partial<WebsocketDiagnostics>
    audio?: Partial<AudioDiagnostics>
    conversation?: Partial<ConversationDiagnostics>
  }): void {
    if (state.websocket) {
      Object.assign(this.websocket, state.websocket)
    }
    if (state.audio) {
      Object.assign(this.audio, state.audio)
    }
    if (state.conversation) {
      Object.assign(this.conversation, state.conversation)
    }
  }

  getEvents(): DiagnosticEvent[] {
    return this.events.toArray()
  }

  snapshot(): DiagnosticsSnapshot {
    return {
      websocket: { ...this.websocket },
      audio: { ...this.audio },
      conversation: { ...this.conversation },
      recentEvents: this.events.toArray(),
      collectedAt: Date.now(),
      totalEvents: this.totalEvents
    }
  }

  exportState(): object {
    return JSON.parse(JSON.stringify(this.snapshot()))
  }

  clear(): void {
    this.events.clear()
    this.totalEvents = 0
  }
}
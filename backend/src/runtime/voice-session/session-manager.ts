import type { WebSocket } from 'ws'
import type { Logger } from 'pino'
import { VoiceSession } from './voice-session.js'

export class SessionManager {
  private sessions: Map<string, VoiceSession> = new Map()
  private wsToSession: Map<string, string> = new Map()
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  create(ws: WebSocket): VoiceSession {
    const session = new VoiceSession(ws, this.logger)
    this.sessions.set(session.sessionId, session)
    this.wsToSession.set((ws as any)._socket?.remoteAddress ?? session.sessionId, session.sessionId)
    this.logger.debug({ sessionId: session.sessionId }, 'session.registered')
    return session
  }

  get(sessionId: string): VoiceSession | undefined {
    return this.sessions.get(sessionId)
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.destroy()
      this.sessions.delete(sessionId)
      for (const [key, value] of this.wsToSession) {
        if (value === sessionId) {
          this.wsToSession.delete(key)
          break
        }
      }
      this.logger.debug({ sessionId }, 'session.unregistered')
    }
  }

  destroyByWs(ws: WebSocket): void {
    const ip = (ws as any)._socket?.remoteAddress
    const sessionId = ip ? this.wsToSession.get(ip) : undefined
    if (sessionId) {
      this.destroy(sessionId)
    }
  }

  get size(): number {
    return this.sessions.size
  }

  getAll(): VoiceSession[] {
    return Array.from(this.sessions.values())
  }
}
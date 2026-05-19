import type { WebSocket } from 'ws'
import { parseMessage, isValidBinaryFrame } from '../handlers/session-handler.js'
import { HEARTBEAT_INTERVAL_MS } from '@livekit-voice/shared/constants'
import type { SessionManager } from '../../runtime/voice-session/session-manager.js'
import type { Logger } from 'pino'

export class GatewayServer {
  private sessionManager: SessionManager
  private logger: Logger
  private heartbeatIntervals: Map<WebSocket, ReturnType<typeof setInterval>> = new Map()

  constructor(sessionManager: SessionManager, logger: Logger) {
    this.sessionManager = sessionManager
    this.logger = logger
  }

  handleConnection(ws: WebSocket): void {
    const ip = (ws as any)._socket?.remoteAddress ?? 'unknown'
    this.logger.info({ ip }, 'ws.connection.open')

    const session = this.sessionManager.create(ws)

    ws.on('message', (data: Buffer | string, isBinary: boolean) => {
      try {
        this.logger.debug({ sessionId: session.sessionId, isBinary, size: typeof data === 'string' ? data.length : data.length }, 'ws.message.received')
        const buf = typeof data === 'string' ? Buffer.from(data) : data
        if (isBinary) {
          // Format: [seq: uint32 (4 bytes, little-endian)][PCM: Int16[]]
          if (buf.length < 5) {
            this.logger.warn({ sessionId: session.sessionId, size: buf.length }, 'binary.frame.too.small')
            return
          }
          const seq = buf.readUInt32LE(0)
          const pcmData = buf.slice(4)
          if (!isValidBinaryFrame(pcmData)) {
            this.logger.warn({ sessionId: session.sessionId, size: pcmData.length }, 'binary.frame.too.large')
            return
          }
          session.handleBinaryFrame(pcmData, seq)
        } else {
          const msg = parseMessage(buf)
          this.logger.debug({ sessionId: session.sessionId, type: msg.type }, 'ws.message.parsed')
          session.handleMessage(msg)
        }
      } catch (err) {
        this.logger.error({ sessionId: session.sessionId, err }, 'ws.message.error')
        session.send({ type: 'session.error', error: 'Invalid message', code: 4001 })
      }
    })

    ws.on('close', () => {
      this.clearHeartbeat(ws)
      this.sessionManager.destroyByWs(ws)
      this.logger.info({ sessionId: session.sessionId }, 'ws.connection.close')
    })

    ws.on('error', (err: Error) => {
      this.logger.error({ sessionId: session.sessionId, err }, 'ws.connection.error')
    })

    ws.on('pong', () => {
      // heartbeat acknowledged
    })

    this.startHeartbeat(ws)
  }

  private startHeartbeat(ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping()
      }
    }, HEARTBEAT_INTERVAL_MS)
    this.heartbeatIntervals.set(ws, interval)
  }

  private clearHeartbeat(ws: WebSocket): void {
    const interval = this.heartbeatIntervals.get(ws)
    if (interval) {
      clearInterval(interval)
      this.heartbeatIntervals.delete(ws)
    }
  }

  close(): void {
    for (const [ws, interval] of this.heartbeatIntervals) {
      clearInterval(interval)
      ws.terminate()
    }
    this.heartbeatIntervals.clear()
  }
}
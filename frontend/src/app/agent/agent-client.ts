/**
 * AgentClient - WebSocket wrapper for Robot Agent communication
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Promise-based execute() with request/response correlation
 * - Heartbeat (ping/pong) for connection health
 * - Event-driven message dispatch
 */

import { getLogger } from '@livekit-voice/shared/logger'
import type {
  AgentMessage,
  ExecuteMessage,
  ExecuteResultMessage,
} from './agent-protocol'

const logger = getLogger()

const DEFAULT_TIMEOUT = 30000 // 30s
const HEARTBEAT_INTERVAL = 15000 // 15s

interface PendingRequest {
  resolve: (result: ExecuteResultMessage) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

type MessageHandler = (msg: AgentMessage) => void

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export class AgentClient {
  private ws: WebSocket | null = null
  private url: string
  private pendingRequests = new Map<string, PendingRequest>()
  private messageHandlers = new Set<MessageHandler>()
  private stateChangeHandlers = new Set<(state: ConnectionState) => void>()
  private state: ConnectionState = 'disconnected'
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000

  constructor(url: string) {
    this.url = url
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      this.setState('connecting')
      logger.info('agent.connecting', { url: this.url })

      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.setState('connected')
          this.reconnectAttempts = 0
          logger.info('agent.connected')
          this.startHeartbeat()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as AgentMessage
            this.handleMessage(msg)
          } catch (err) {
            logger.error('agent.message.parse.error', { err, data: event.data })
          }
        }

        this.ws.onclose = (event) => {
          logger.info('agent.disconnected', { code: event.code, reason: event.reason })
          this.handleDisconnect()
        }

        this.ws.onerror = (err) => {
          logger.error('agent.error', { err })
          this.setState('error')
          reject(err)
        }
      } catch (err) {
        this.setState('error')
        reject(err)
      }
    })
  }

  /**
   * Execute a capability and return a Promise that resolves with the result
   */
  execute(capability: string, payload?: Record<string, unknown>): Promise<ExecuteResultMessage> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Agent WebSocket is not connected'))
        return
      }

      const requestId = crypto.randomUUID()
      const msg: ExecuteMessage = {
        type: 'execute',
        request_id: requestId,
        capability,
        payload,
      }

      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Execute timeout for capability: ${capability}`))
      }, DEFAULT_TIMEOUT)

      this.pendingRequests.set(requestId, { resolve, reject, timer })

      try {
        this.ws.send(JSON.stringify(msg))
        logger.debug('agent.execute.sent', { requestId, capability })
      } catch (err) {
        this.pendingRequests.delete(requestId)
        clearTimeout(timer)
        reject(err)
      }
    })
  }

  cancel(requestId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ type: 'cancel', request_id: requestId }))
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.setState('disconnected')
    logger.info('agent.disconnected.by.client')
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateChangeHandlers.add(handler)
    return () => this.stateChangeHandlers.delete(handler)
  }

  getState(): ConnectionState {
    return this.state
  }

  private handleMessage(msg: AgentMessage): void {
    logger.debug('agent.message.received', { type: msg.type })

    // Handle execute.result correlation
    if (msg.type === 'execute.result') {
      const pending = this.pendingRequests.get(msg.request_id)
      if (pending) {
        clearTimeout(pending.timer)
        this.pendingRequests.delete(msg.request_id)
        pending.resolve(msg)
      }
    }

    // Dispatch to all handlers
    this.messageHandlers.forEach((handler) => handler(msg))
  }

  private handleDisconnect(): void {
    this.stopHeartbeat()
    this.setState('disconnected')

    // Reject all pending requests
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timer)
      pending.reject(new Error('WebSocket disconnected'))
    })
    this.pendingRequests.clear()

    // Auto reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      logger.info('agent.reconnect.scheduled', { attempt: this.reconnectAttempts, delay })
      setTimeout(() => {
        this.connect().catch(() => {
          // reconnect manager handles next attempt
        })
      }, delay)
    } else {
      logger.error('agent.reconnect.exhausted')
      this.setState('error')
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat.ack', timestamp: Date.now() }))
      }
    }, HEARTBEAT_INTERVAL)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState
      this.stateChangeHandlers.forEach((handler) => handler(newState))
    }
  }
}

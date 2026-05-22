import { DEFAULT_TRANSPORT_CONFIG, type TransportConfig, type ClientEventName } from './protocol'
import type { TransportStateInfo } from './transport-state'
import { ReconnectManager } from './reconnect-manager'
import { createInitialTransportState } from './transport-state'
import { getLogger } from '@livekit-voice/shared/logger'
import { invariant } from '../../../../../self-healing/assert'
import { diagnosticsCollector } from '../debug-provider'

const logger = getLogger()

type MessageHandler = (event: { type: string; [key: string]: unknown }) => void
type BinaryHandler = (data: Uint8Array) => void
type StateChangeHandler = (state: TransportStateInfo) => void

export class WebSocketClient {
  private ws: WebSocket | null = null
  private config: TransportConfig
  private reconnectManager: ReconnectManager
  private state: TransportStateInfo = createInitialTransportState()
  private messageHandlers: Set<MessageHandler> = new Set()
  private binaryHandlers: Set<BinaryHandler> = new Set()
  private stateHandlers: Set<StateChangeHandler> = new Set()

  constructor(config: TransportConfig = DEFAULT_TRANSPORT_CONFIG) {
    this.config = config
    this.reconnectManager = new ReconnectManager(config)
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      this.updateState({ state: 'connecting' })
      diagnosticsCollector.add({
        source: 'transport.websocket',
        type: 'connection.connecting',
        metadata: { url: this.config.url }
      })
      logger.info('transport.connecting', { url: this.config.url })

      try {
        this.ws = new WebSocket(this.config.url)

        this.ws.onopen = () => {
          this.updateState({ state: 'connected', lastConnectedAt: Date.now() })
          diagnosticsCollector.add({
            source: 'transport.websocket',
            type: 'connection.opened',
            metadata: { url: this.config.url }
          })
          logger.info('transport.connected')
          this.reconnectManager.onConnectionSuccess()
          resolve()
        }

        this.ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            this.binaryHandlers.forEach(handler => handler(new Uint8Array(event.data)))
            return
          }
          try {
            const data = JSON.parse(event.data)
            this.messageHandlers.forEach((handler) => handler(data))
          } catch (err) {
            logger.error('transport.message.parse.error', { err })
          }
        }

        this.ws.onclose = (event) => {
          logger.info('transport.disconnected', { code: event.code, reason: event.reason })
          this.handleDisconnect()
          diagnosticsCollector.add({
            source: 'transport.websocket',
            type: 'connection.closed',
            metadata: { code: event.code, reason: event.reason }
          })
        }

        this.ws.onerror = (err) => {
          logger.error('transport.error', { err })
          this.updateState({ state: 'error', error: 'WebSocket error' })
          diagnosticsCollector.add({
            source: 'transport.websocket',
            type: 'connection.error'
          })
          reject(err)
        }
      } catch (err) {
        this.updateState({ state: 'error', error: String(err) })
        reject(err)
      }
    })
  }

  send(event: { type: ClientEventName; [key: string]: unknown }): void {
    invariant(this.ws != null, 'ws must be initialized before send')
    invariant(this.ws.readyState === WebSocket.OPEN, 'ws must be OPEN before sending JSON message')

    try {
      this.ws.send(JSON.stringify(event))
      logger.debug('transport.sent', { type: event.type })
    } catch (err) {
      logger.error('transport.send.error', { err })
    }
  }

  sendBinary(data: Uint8Array): void {
    invariant(this.ws != null, 'ws must be initialized before sendBinary')
    invariant(this.ws.readyState === WebSocket.OPEN, 'ws must be OPEN before sending binary data')
    invariant(data != null && data.length > 0, 'binary data must be non-empty')

    try {
      this.ws.send(data)
      logger.debug('transport.sent.binary', { size: data.length })
    } catch (err) {
      logger.error('transport.sendBinary.error', { err })
    }
  }

  disconnect(): void {
    this.reconnectManager.reset()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.updateState({ state: 'disconnected' })
    logger.info('transport.disconnected.by.client')
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onBinary(handler: (data: ArrayBuffer) => void): () => void {
    this.binaryHandlers.add((data: Uint8Array) => handler(data.buffer as ArrayBuffer))
    return () => this.binaryHandlers.clear()
  }

  onStateChange(handler: StateChangeHandler): () => void {
    this.stateHandlers.add(handler)
    return () => this.stateHandlers.delete(handler)
  }

  getState(): TransportStateInfo {
    return { ...this.state }
  }

  private handleDisconnect(): void {
    if (!this.config.reconnect) {
      this.updateState({ state: 'disconnected' })
      return
    }

    if (this.reconnectManager.isExhausted()) {
      logger.warn('transport.reconnect.exhausted')
      this.updateState({ state: 'error', error: 'Max reconnect attempts reached' })
      return
    }

    this.updateState({ state: 'reconnecting', reconnectAttempt: this.reconnectManager.getState().attemptCount })

    this.reconnectManager.startReconnect(
      (attempt) => {
        logger.info('transport.reconnect.attempt', { attempt })
        this.connect().catch(() => {
          // ReconnectManager will handle next attempt
        })
      },
      () => {
        logger.info('transport.reconnect.success')
        this.updateState({ state: 'connected', lastConnectedAt: Date.now() })
      },
      () => {
        logger.error('transport.reconnect.failed')
        this.updateState({ state: 'error', error: 'Reconnect failed' })
      }
    )
  }

  private updateState(partial: Partial<TransportStateInfo>): void {
    this.state = { ...this.state, ...partial }
    this.stateHandlers.forEach((handler) => handler(this.state))

    if (partial.state === 'connected') {
      diagnosticsCollector.updateState({
        websocket: { connected: true, lastConnectedAt: partial.lastConnectedAt }
      })
    } else if (partial.state === 'disconnected' || partial.state === 'error') {
      diagnosticsCollector.updateState({
        websocket: { connected: false }
      })
    }
  }
}

export const wsClient = new WebSocketClient()
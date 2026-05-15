import { DEFAULT_TRANSPORT_CONFIG, type TransportConfig, type ClientEventName } from './protocol'
import type { TransportStateInfo } from './transport-state'
import { ReconnectManager } from './reconnect-manager'
import { createInitialTransportState } from './transport-state'
import { getLogger } from '../../core/logger'

const logger = getLogger()

type MessageHandler = (event: { type: string; [key: string]: unknown }) => void
type StateChangeHandler = (state: TransportStateInfo) => void

export class WebSocketClient {
  private ws: WebSocket | null = null
  private config: TransportConfig
  private reconnectManager: ReconnectManager
  private state: TransportStateInfo = createInitialTransportState()
  private messageHandlers: Set<MessageHandler> = new Set()
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
      logger.info('transport.connecting', { url: this.config.url })

      try {
        this.ws = new WebSocket(this.config.url)

        this.ws.onopen = () => {
          logger.info('transport.connected')
          this.updateState({ state: 'connected', lastConnectedAt: Date.now() })
          this.reconnectManager.onConnectionSuccess()
          resolve()
        }

        this.ws.onmessage = (event) => {
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
        }

        this.ws.onerror = (err) => {
          logger.error('transport.error', { err })
          this.updateState({ state: 'error', error: 'WebSocket error' })
          reject(err)
        }
      } catch (err) {
        this.updateState({ state: 'error', error: String(err) })
        reject(err)
      }
    })
  }

  send(event: { type: ClientEventName; [key: string]: unknown }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('transport.send.failed.not.connected')
      return
    }

    try {
      this.ws.send(JSON.stringify(event))
      logger.debug('transport.sent', { type: event.type })
    } catch (err) {
      logger.error('transport.send.error', { err })
    }
  }

  sendBinary(data: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('transport.sendBinary.failed.not.connected')
      return
    }

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
  }
}

export const wsClient = new WebSocketClient()
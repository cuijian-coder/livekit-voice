import type { TransportConfig } from './protocol'

export interface ReconnectState {
  attemptCount: number
  maxAttempts: number
  isReconnecting: boolean
}

export type ReconnectEvent = 'attempt' | 'success' | 'failed' | 'exhausted'

export class ReconnectManager {
  private state: ReconnectState = {
    attemptCount: 0,
    maxAttempts: 0,
    isReconnecting: false,
  }
  private timer: ReturnType<typeof setTimeout> | null = null
  private config: TransportConfig

  constructor(config: TransportConfig) {
    this.config = config
    this.state.maxAttempts = config.maxReconnectAttempts
  }

  startReconnect(onAttempt: (attempt: number) => void, onSuccess: () => void, onFailed: () => void): void {
    if (this.state.attemptCount >= this.state.maxAttempts) {
      onFailed()
      return
    }

    this.state.isReconnecting = true
    this.state.attemptCount++

    const delay = this.config.reconnectIntervalMs * this.state.attemptCount
    console.log(`[ReconnectManager] Attempt ${this.state.attemptCount}/${this.state.maxAttempts} in ${delay}ms`)

    this.timer = setTimeout(() => {
      onAttempt(this.state.attemptCount)
    }, delay)
  }

  onConnectionSuccess(): void {
    this.reset()
  }

  reset(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.state = {
      attemptCount: 0,
      maxAttempts: this.config.maxReconnectAttempts,
      isReconnecting: false,
    }
  }

  getState(): Readonly<ReconnectState> {
    return { ...this.state }
  }

  isExhausted(): boolean {
    return this.state.attemptCount >= this.state.maxAttempts
  }
}
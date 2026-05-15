export type DiagnosticsSnapshot = {
  stateTransitions: Array<{ from: string | null; to: string; ts: number }>
  interruptions: Array<{ turnId: string; reason: 'user' | 'error' | 'timeout'; ts: number }>
  websocketReconnects: number
  audioUnderruns: number
  streamErrors: Array<{ worker: 'asr' | 'llm' | 'tts'; error: string; ts: number }>
  latency: {
    asrStart: number | null
    llmFirstToken: number | null
    ttsFirstChunk: number | null
    playbackStart: number | null
  }
}

export type DiagnosticsSummary = {
  totalTransitions: number
  totalInterruptions: number
  totalErrors: number
  currentLatency: DiagnosticsSnapshot['latency']
}

export class DiagnosticsCollector {
  private stateTransitions: DiagnosticsSnapshot['stateTransitions'] = []
  private interruptions: DiagnosticsSnapshot['interruptions'] = []
  private streamErrors: DiagnosticsSnapshot['streamErrors'] = []

  private _websocketReconnects = 0
  private _audioUnderruns = 0

  private latency: DiagnosticsSnapshot['latency'] = {
    asrStart: null,
    llmFirstToken: null,
    ttsFirstChunk: null,
    playbackStart: null,
  }

  recordTransition(from: string | null, to: string): void {
    this.stateTransitions.push({ from, to, ts: Date.now() })
    if (this.stateTransitions.length > 1000) {
      this.stateTransitions = this.stateTransitions.slice(-500)
    }
  }

  recordInterrupt(turnId: string, reason: 'user' | 'error' | 'timeout'): void {
    this.interruptions.push({ turnId, reason, ts: Date.now() })
    if (this.interruptions.length > 100) {
      this.interruptions = this.interruptions.slice(-50)
    }
  }

  recordStreamError(worker: 'asr' | 'llm' | 'tts', error: string): void {
    this.streamErrors.push({ worker, error, ts: Date.now() })
    if (this.streamErrors.length > 100) {
      this.streamErrors = this.streamErrors.slice(-50)
    }
  }

  recordAsrStart(): void {
    this.latency.asrStart = Date.now()
  }

  private llmTokens: number = 0
  private ttsBytes: number = 0

  recordLlmToken(_token: string): void {
    this.llmTokens++
    if (!this.latency.llmFirstToken) {
      this.latency.llmFirstToken = Date.now()
    }
  }

  recordTtsChunk(bytes: number): void {
    this.ttsBytes += bytes
    if (!this.latency.ttsFirstChunk) {
      this.latency.ttsFirstChunk = Date.now()
    }
  }

  recordLlmFirstToken(): void {
    this.latency.llmFirstToken = Date.now()
  }

  recordTtsFirstChunk(): void {
    this.latency.ttsFirstChunk = Date.now()
  }

  recordPlaybackStart(): void {
    this.latency.playbackStart = Date.now()
  }

  recordWebsocketReconnect(): void {
    this._websocketReconnects++
  }

  recordAudioUnderrun(): void {
    this._audioUnderruns++
  }

  getSnapshot(): DiagnosticsSnapshot {
    return {
      stateTransitions: [...this.stateTransitions],
      interruptions: [...this.interruptions],
      websocketReconnects: this._websocketReconnects,
      audioUnderruns: this._audioUnderruns,
      streamErrors: [...this.streamErrors],
      latency: { ...this.latency },
    }
  }

  getSummary(): DiagnosticsSummary {
    return {
      totalTransitions: this.stateTransitions.length,
      totalInterruptions: this.interruptions.length,
      totalErrors: this.streamErrors.length,
      currentLatency: { ...this.latency },
    }
  }

  resetLatency(): void {
    this.latency = {
      asrStart: null,
      llmFirstToken: null,
      ttsFirstChunk: null,
      playbackStart: null,
    }
  }

  get websocketReconnects(): number {
    return this._websocketReconnects
  }

  get audioUnderruns(): number {
    return this._audioUnderruns
  }
}
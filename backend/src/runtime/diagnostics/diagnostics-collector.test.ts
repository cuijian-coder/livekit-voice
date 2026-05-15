import { describe, it, expect } from 'vitest'
import { DiagnosticsCollector } from './diagnostics-collector'

describe('DiagnosticsCollector', () => {
  it('should record transitions', () => {
    const collector = new DiagnosticsCollector()
    collector.recordTransition(null, 'listening')
    collector.recordTransition('listening', 'transcribing')

    const snapshot = collector.getSnapshot()
    expect(snapshot.stateTransitions).toHaveLength(2)
    expect(snapshot.stateTransitions[0].from).toBeNull()
    expect(snapshot.stateTransitions[0].to).toBe('listening')
    expect(snapshot.stateTransitions[1].from).toBe('listening')
    expect(snapshot.stateTransitions[1].to).toBe('transcribing')
  })

  it('should record interrupts', () => {
    const collector = new DiagnosticsCollector()
    collector.recordInterrupt('turn-1', 'user')
    collector.recordInterrupt('turn-2', 'error')

    const snapshot = collector.getSnapshot()
    expect(snapshot.interruptions).toHaveLength(2)
    expect(snapshot.interruptions[0].reason).toBe('user')
    expect(snapshot.interruptions[1].reason).toBe('error')
  })

  it('should record stream errors', () => {
    const collector = new DiagnosticsCollector()
    collector.recordStreamError('asr', 'connection failed')
    collector.recordStreamError('llm', 'timeout')

    const snapshot = collector.getSnapshot()
    expect(snapshot.streamErrors).toHaveLength(2)
    expect(snapshot.streamErrors[0].worker).toBe('asr')
    expect(snapshot.streamErrors[0].error).toBe('connection failed')
  })

  it('should record latency metrics', () => {
    const collector = new DiagnosticsCollector()

    collector.recordAsrStart()
    expect(collector.getSnapshot().latency.asrStart).not.toBeNull()

    collector.recordLlmFirstToken()
    expect(collector.getSnapshot().latency.llmFirstToken).not.toBeNull()

    collector.recordTtsFirstChunk()
    expect(collector.getSnapshot().latency.ttsFirstChunk).not.toBeNull()

    collector.recordPlaybackStart()
    expect(collector.getSnapshot().latency.playbackStart).not.toBeNull()
  })

  it('should reset latency', () => {
    const collector = new DiagnosticsCollector()
    collector.recordAsrStart()
    collector.recordLlmFirstToken()
    expect(collector.getSnapshot().latency.asrStart).not.toBeNull()

    collector.resetLatency()
    const snapshot = collector.getSnapshot()
    expect(snapshot.latency.asrStart).toBeNull()
    expect(snapshot.latency.llmFirstToken).toBeNull()
    expect(snapshot.latency.ttsFirstChunk).toBeNull()
    expect(snapshot.latency.playbackStart).toBeNull()
  })

  it('should count websocket reconnects', () => {
    const collector = new DiagnosticsCollector()
    expect(collector.websocketReconnects).toBe(0)
    collector.recordWebsocketReconnect()
    collector.recordWebsocketReconnect()
    expect(collector.websocketReconnects).toBe(2)
  })

  it('should count audio underruns', () => {
    const collector = new DiagnosticsCollector()
    expect(collector.audioUnderruns).toBe(0)
    collector.recordAudioUnderrun()
    collector.recordAudioUnderrun()
    collector.recordAudioUnderrun()
    expect(collector.audioUnderruns).toBe(3)
  })

  it('should return summary', () => {
    const collector = new DiagnosticsCollector()
    collector.recordTransition(null, 'listening')
    collector.recordInterrupt('turn-1', 'user')
    collector.recordStreamError('asr', 'err')

    const summary = collector.getSummary()
    expect(summary.totalTransitions).toBe(1)
    expect(summary.totalInterruptions).toBe(1)
    expect(summary.totalErrors).toBe(1)
  })
})
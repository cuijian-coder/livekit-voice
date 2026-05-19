import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createActor } from 'xstate'

vi.mock('../../runtime/transport/websocket-client', () => ({
  wsClient: {
    send: vi.fn(),
    sendBinary: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    onMessage: vi.fn(),
    onBinary: vi.fn(),
    onStateChange: vi.fn(),
    getState: vi.fn().mockReturnValue({ state: 'connected' }),
  },
}))

vi.mock('../../runtime/transport', () => ({
  binaryTransport: {
    startTurn: vi.fn(),
    sendFrame: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
  },
}))

vi.mock('../../runtime/audio/speech-detector', () => ({
  speechDetector: {
    setStateChangeHandler: vi.fn(),
    setAssistantSpeaking: vi.fn(),
    reset: vi.fn(),
  },
}))

vi.mock('../../runtime/audio/recorder', () => ({
  audioRecorder: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    resetWorkletSeq: vi.fn(),
  },
}))

import { voiceMachine } from './voice-machine'

describe('voiceMachine', () => {
  let actor: ReturnType<typeof createActor>

  beforeEach(() => {
    actor = createActor(voiceMachine)
    actor.start()
  })

  it('should start in idle state', () => {
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
  })

  it('should transition to listening on session.start', () => {
    actor.send({ type: 'session.start' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('listening')
  })

  it('should transition to thinking on audio.commit', () => {
    actor.send({ type: 'session.start' })
    actor.send({ type: 'audio.commit' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('thinking')
  })

  it('should transition to thinking on SUBMIT_TEXT', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('thinking')
  })

  it('should transition to speaking on llm.complete', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'llm.complete', fullText: 'response' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('speaking')
  })

  it('should stay in speaking on subsequent llm.complete', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'llm.complete', fullText: 'response' })
    actor.send({ type: 'llm.complete', fullText: 'complete response' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('speaking')
  })

  it('should transition to listening on tts.complete (continuous conversation)', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'llm.complete', fullText: 'complete' })
    actor.send({ type: 'tts.complete' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('listening')
  })

  it('should transition to idle on interrupt.request from listening', () => {
    actor.send({ type: 'session.start' })
    actor.send({ type: 'interrupt.request' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
  })

  it('should transition to idle on interrupt.request from thinking', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'interrupt.request' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
  })

  it('should transition to idle on interrupt.request from speaking', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'llm.complete', fullText: 'response' })
    actor.send({ type: 'interrupt.request' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
  })

  it('should update turnId on session.start', () => {
    const before = actor.getSnapshot().context.turnId
    actor.send({ type: 'session.start' })
    const after = actor.getSnapshot().context.turnId
    expect(after).not.toBe(before)
    expect(after).toMatch(/^turn-/)
  })

  it('should update requestId on SUBMIT_TEXT', () => {
    const before = actor.getSnapshot().context.requestId
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    const after = actor.getSnapshot().context.requestId
    expect(after).not.toBe(before)
  })

  it('should clear streamBuffer on interrupt.request', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'llm.complete', fullText: 'response' })
    const beforeInterrupt = actor.getSnapshot().context.streamBuffer
    expect(beforeInterrupt).toBe('response')
    actor.send({ type: 'interrupt.request' })
    const afterInterrupt = actor.getSnapshot().context.streamBuffer
    expect(afterInterrupt).toBe('')
  })

  it('should set abortController in thinking state', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.context.abortController).toBeDefined()
  })

  it('should keep in speaking state after llm.complete', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'llm.complete', fullText: 'response' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('speaking')
  })

  it('should update streamBuffer on llm.token', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'llm.complete', fullText: 'initial' })
    actor.send({ type: 'llm.token', text: 'updated' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.context.streamBuffer).toBe('updated')
  })

  it('should transition to error on runtime.error', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'runtime.error', error: 'failed' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('error')
    expect(snapshot.context.error).toBe('failed')
  })

  it('should transition to idle on session.start from error', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'runtime.error', error: 'failed' })
    actor.send({ type: 'session.start' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
  })

  describe('asr.partial in listening state', () => {
    it('should update partialTranscript on asr.partial in listening', () => {
      actor.send({ type: 'session.start' })
      actor.send({ type: 'asr.partial', text: '你好' })
      const snapshot = actor.getSnapshot()
      expect(snapshot.context.partialTranscript).toBe('你好')
    })

    it('should update partialTranscript on asr.partial in thinking', () => {
      actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
      actor.send({ type: 'asr.partial', text: '正在说话' })
      const snapshot = actor.getSnapshot()
      expect(snapshot.context.partialTranscript).toBe('正在说话')
    })
  })

  describe('asr.final in listening state', () => {
    it('should update transcript on asr.final in listening', () => {
      actor.send({ type: 'session.start' })
      actor.send({ type: 'asr.final', text: '最终文本' })
      const snapshot = actor.getSnapshot()
      expect(snapshot.context.transcript).toBe('最终文本')
    })

    it('should update transcript on asr.final in thinking', () => {
      actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
      actor.send({ type: 'asr.final', text: '最终文本' })
      const snapshot = actor.getSnapshot()
      expect(snapshot.context.transcript).toBe('最终文本')
    })
  })

  describe('INTERRUPTING event', () => {
    it('should transition to listening on INTERRUPTING from speaking', () => {
      actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
      actor.send({ type: 'llm.complete', fullText: 'response' })
      expect(actor.getSnapshot().value).toBe('speaking')
      actor.send({ type: 'INTERRUPTING' })
      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('listening')
    })

    it('should reset session on INTERRUPTING', () => {
      actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
      actor.send({ type: 'llm.complete', fullText: 'response' })
      actor.send({ type: 'INTERRUPTING' })
      const snapshot = actor.getSnapshot()
      expect(snapshot.context.streamBuffer).toBe('')
      expect(snapshot.context.turnId).toBe('')
    })
  })

  describe('continuous conversation flow', () => {
    it('should go listening -> thinking -> speaking -> listening', () => {
      actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
      expect(actor.getSnapshot().value).toBe('thinking')

      actor.send({ type: 'llm.complete', fullText: 'response' })
      expect(actor.getSnapshot().value).toBe('speaking')

      actor.send({ type: 'tts.complete' })
      expect(actor.getSnapshot().value).toBe('listening')
    })

    it('should allow multiple conversation cycles', () => {
      actor.send({ type: 'SUBMIT_TEXT', text: 'first' })
      actor.send({ type: 'llm.complete', fullText: 'first response' })
      actor.send({ type: 'tts.complete' })
      expect(actor.getSnapshot().value).toBe('listening')

      actor.send({ type: 'audio.commit' })
      actor.send({ type: 'llm.complete', fullText: 'second response' })
      actor.send({ type: 'tts.complete' })
      expect(actor.getSnapshot().value).toBe('listening')
    })
  })
})
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateVoiceState, validateTransition } from './validation'

describe('validateTransition', () => {
  it('should allow idle -> listening', () => {
    const result = validateTransition('idle', 'START_RECORDING', 'listening')
    expect(result.valid).toBe(true)
  })

  it('should allow idle -> thinking', () => {
    const result = validateTransition('idle', 'SUBMIT_TEXT', 'thinking')
    expect(result.valid).toBe(true)
  })

  it('should allow listening -> thinking', () => {
    const result = validateTransition('listening', 'STOP_RECORDING', 'thinking')
    expect(result.valid).toBe(true)
  })

  it('should allow listening -> idle (interrupt)', () => {
    const result = validateTransition('listening', 'INTERRUPT', 'idle')
    expect(result.valid).toBe(true)
  })

  it('should allow thinking -> streaming', () => {
    const result = validateTransition('thinking', 'LLM_DONE', 'streaming')
    expect(result.valid).toBe(true)
  })

  it('should allow streaming -> playing', () => {
    const result = validateTransition('streaming', 'LLM_DONE', 'playing')
    expect(result.valid).toBe(true)
  })

  it('should allow playing -> idle', () => {
    const result = validateTransition('playing', 'TTS_FINISHED', 'idle')
    expect(result.valid).toBe(true)
  })

  it('should reject idle -> streaming (invalid)', () => {
    const result = validateTransition('idle', 'LLM_DONE', 'streaming')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Invalid transition')
  })

  it('should reject idle -> playing (invalid)', () => {
    const result = validateTransition('idle', 'ANY_EVENT', 'playing')
    expect(result.valid).toBe(false)
  })

  it('should reject listening -> streaming (invalid)', () => {
    const result = validateTransition('listening', 'ANY_EVENT', 'streaming')
    expect(result.valid).toBe(false)
  })

  it('should reject playing -> thinking (invalid)', () => {
    const result = validateTransition('playing', 'ANY_EVENT', 'thinking')
    expect(result.valid).toBe(false)
  })

  it('should return reason for invalid transition', () => {
    const result = validateTransition('idle', 'START_RECORDING', 'playing')
    expect(result.reason).toBe('Invalid transition: idle -> playing via START_RECORDING')
  })

  it('should handle unknown prevState', () => {
    const result = validateTransition('unknown', 'ANY', 'idle')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Unknown prevState')
  })
})

describe('validateVoiceState', () => {
  it('should pass for idle state', () => {
    const snapshot = {
      value: 'idle',
      context: {
        requestId: 'req-123',
        transcript: '',
        partialTranscript: '',
        streamBuffer: '',
        sessionId: 'sess-1',
        abortController: undefined,
        error: undefined
      }
    }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should fail when requestId is missing', () => {
    const snapshot = {
      value: 'idle',
      context: {
        requestId: '',
        transcript: '',
        partialTranscript: '',
        streamBuffer: '',
        sessionId: 'sess-1',
        abortController: undefined,
        error: undefined
      }
    }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('requestId'))).toBe(true)
  })

  it('should fail for streaming without streamBuffer', () => {
    const snapshot = {
      value: 'streaming',
      context: {
        requestId: 'req-123',
        transcript: '',
        partialTranscript: '',
        streamBuffer: '',
        sessionId: 'sess-1',
        abortController: undefined,
        error: undefined
      }
    }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(false)
  })

  it('should pass for streaming with streamBuffer', () => {
    const snapshot = {
      value: 'streaming',
      context: {
        requestId: 'req-123',
        transcript: '',
        partialTranscript: '',
        streamBuffer: 'Hello world',
        sessionId: 'sess-1',
        abortController: undefined,
        error: undefined
      }
    }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(true)
  })

  it('should fail for thinking without abortController', () => {
    const snapshot = {
      value: 'thinking',
      context: {
        requestId: 'req-123',
        transcript: '',
        partialTranscript: '',
        streamBuffer: '',
        sessionId: 'sess-1',
        abortController: undefined,
        error: undefined
      }
    }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(false)
  })

  it('should pass for thinking with abortController', () => {
    const snapshot = {
      value: 'thinking',
      context: {
        requestId: 'req-123',
        transcript: '',
        partialTranscript: '',
        streamBuffer: '',
        sessionId: 'sess-1',
        abortController: new AbortController(),
        error: undefined
      }
    }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(true)
  })

  it('should pass for playing with streamBuffer', () => {
    const snapshot = {
      value: 'playing',
      context: {
        requestId: 'req-123',
        transcript: '',
        partialTranscript: '',
        streamBuffer: 'Hello',
        sessionId: 'sess-1',
        abortController: undefined,
        error: undefined
      }
    }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(true)
  })

  it('should add warning for abortController in playing state', () => {
    const snapshot = {
      value: 'playing',
      context: {
        requestId: 'req-123',
        transcript: '',
        partialTranscript: '',
        streamBuffer: 'Hello',
        sessionId: 'sess-1',
        abortController: new AbortController(),
        error: undefined
      }
    }
    const result = validateVoiceState(snapshot as any)
    expect(result.warnings.some(w => w.includes('abortController'))).toBe(true)
  })
})
import { describe, it, expect } from 'vitest'
import { validateVoiceState, validateTransition } from './validation'

describe('validateTransition', () => {
  it('should allow idle -> listening', () => {
    const result = validateTransition('idle', 'session.start', 'listening')
    expect(result.valid).toBe(true)
  })

  it('should allow idle -> thinking', () => {
    const result = validateTransition('idle', 'SUBMIT_TEXT', 'thinking')
    expect(result.valid).toBe(true)
  })

  it('should allow idle -> error', () => {
    const result = validateTransition('idle', 'runtime.error', 'error')
    expect(result.valid).toBe(true)
  })

  it('should allow listening -> transcribing', () => {
    const result = validateTransition('listening', 'audio.commit', 'transcribing')
    expect(result.valid).toBe(true)
  })

  it('should allow listening -> idle (interrupt)', () => {
    const result = validateTransition('listening', 'interrupt.request', 'idle')
    expect(result.valid).toBe(true)
  })

  it('should allow thinking -> speaking', () => {
    const result = validateTransition('thinking', 'llm.complete', 'speaking')
    expect(result.valid).toBe(true)
  })

  it('should allow thinking -> error', () => {
    const result = validateTransition('thinking', 'runtime.error', 'error')
    expect(result.valid).toBe(true)
  })

  it('should allow speaking -> idle', () => {
    const result = validateTransition('speaking', 'tts.complete', 'idle')
    expect(result.valid).toBe(true)
  })

  it('should allow speaking -> interrupting -> idle', () => {
    const r1 = validateTransition('speaking', 'interrupt.request', 'interrupting')
    expect(r1.valid).toBe(true)
  })

  it('should reject idle -> speaking (invalid)', () => {
    const result = validateTransition('idle', 'llm.complete', 'speaking')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Invalid transition')
  })

  it('should reject idle -> transcribing (invalid)', () => {
    const result = validateTransition('idle', 'ANY_EVENT', 'transcribing')
    expect(result.valid).toBe(false)
  })

  it('should reject listening -> speaking (invalid)', () => {
    const result = validateTransition('listening', 'ANY_EVENT', 'speaking')
    expect(result.valid).toBe(false)
  })

  it('should reject speaking -> thinking (invalid)', () => {
    const result = validateTransition('speaking', 'ANY_EVENT', 'thinking')
    expect(result.valid).toBe(false)
  })

  it('should return reason for invalid transition', () => {
    const result = validateTransition('idle', 'session.start', 'speaking')
    expect(result.reason).toBe('Invalid transition: idle -> speaking via session.start')
  })

  it('should handle unknown prevState', () => {
    const result = validateTransition('unknown', 'ANY', 'idle')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Unknown prevState')
  })

  it('should allow error -> idle', () => {
    const result = validateTransition('error', 'session.start', 'idle')
    expect(result.valid).toBe(true)
  })

  it('should allow error -> recovering', () => {
    const result = validateTransition('error', 'RECOVER', 'recovering')
    expect(result.valid).toBe(true)
  })
})

describe('validateVoiceState', () => {
  const baseContext = {
    requestId: 'req-123',
    transcript: '',
    partialTranscript: '',
    streamBuffer: '',
    sessionId: 'sess-1',
    turnId: '',
    abortController: undefined as AbortController | undefined,
    error: undefined as string | undefined,
  }

  it('should pass for idle state', () => {
    const snapshot = { value: 'idle', context: baseContext }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should fail when requestId is missing', () => {
    const snapshot = { value: 'idle', context: { ...baseContext, requestId: '' } }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('requestId'))).toBe(true)
  })

  it('should fail for speaking without streamBuffer', () => {
    const snapshot = { value: 'speaking', context: { ...baseContext, streamBuffer: '' } }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(false)
  })

  it('should pass for speaking with streamBuffer', () => {
    const snapshot = { value: 'speaking', context: { ...baseContext, streamBuffer: 'Hello world' } }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(true)
  })

  it('should fail for thinking without abortController', () => {
    const snapshot = { value: 'thinking', context: { ...baseContext, abortController: undefined } }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(false)
  })

  it('should pass for thinking with abortController', () => {
    const snapshot = { value: 'thinking', context: { ...baseContext, abortController: new AbortController() } }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(true)
  })

  it('should pass for speaking with streamBuffer', () => {
    const snapshot = { value: 'speaking', context: { ...baseContext, streamBuffer: 'Hello' } }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(true)
  })

  it('should add warning for abortController in speaking state', () => {
    const snapshot = {
      value: 'speaking',
      context: { ...baseContext, streamBuffer: 'Hello', abortController: new AbortController() },
    }
    const result = validateVoiceState(snapshot as any)
    expect(result.warnings.some(w => w.includes('abortController'))).toBe(true)
  })

  it('should pass for listening state', () => {
    const snapshot = { value: 'listening', context: baseContext }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(true)
  })

  it('should pass for transcribing state', () => {
    const snapshot = { value: 'transcribing', context: baseContext }
    const result = validateVoiceState(snapshot as any)
    expect(result.valid).toBe(true)
  })
})
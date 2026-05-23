import { describe, it, expect } from 'vitest'
import { isUserEvent, isSystemEvent, type VoiceEvent } from './voice-events'

describe('isUserEvent', () => {
  it('should return true for session.start', () => {
    const event: VoiceEvent = { type: 'session.start' }
    expect(isUserEvent(event)).toBe(true)
  })

  it('should return true for audio.commit', () => {
    const event: VoiceEvent = { type: 'audio.commit' }
    expect(isUserEvent(event)).toBe(true)
  })

  it('should return true for audio.commit.manual', () => {
    const event: VoiceEvent = { type: 'audio.commit.manual' }
    expect(isUserEvent(event)).toBe(true)
  })

  it('should return true for interrupt.request', () => {
    const event: VoiceEvent = { type: 'interrupt.request' }
    expect(isUserEvent(event)).toBe(true)
  })

  it('should return true for SUBMIT_TEXT', () => {
    const event: VoiceEvent = { type: 'SUBMIT_TEXT', text: 'hello' }
    expect(isUserEvent(event)).toBe(true)
  })

  it('should return false for asr.partial', () => {
    const event: VoiceEvent = { type: 'asr.partial', text: 'hello' }
    expect(isUserEvent(event)).toBe(false)
  })

  it('should return false for asr.final', () => {
    const event: VoiceEvent = { type: 'asr.final', text: 'hello' }
    expect(isUserEvent(event)).toBe(false)
  })

  it('should return false for llm.token', () => {
    const event: VoiceEvent = { type: 'llm.token', text: 'hello' }
    expect(isUserEvent(event)).toBe(false)
  })

  it('should return false for llm.complete', () => {
    const event: VoiceEvent = { type: 'llm.complete', fullText: 'hello' }
    expect(isUserEvent(event)).toBe(false)
  })

  it('should return false for tts.complete', () => {
    const event: VoiceEvent = { type: 'tts.complete' }
    expect(isUserEvent(event)).toBe(false)
  })

  it('should return false for runtime.error', () => {
    const event: VoiceEvent = { type: 'runtime.error', error: 'something' }
    expect(isUserEvent(event)).toBe(false)
  })
})

describe('isSystemEvent', () => {
  it('should return false for session.start', () => {
    const event: VoiceEvent = { type: 'session.start' }
    expect(isSystemEvent(event)).toBe(false)
  })

  it('should return true for asr.partial', () => {
    const event: VoiceEvent = { type: 'asr.partial', text: 'hello' }
    expect(isSystemEvent(event)).toBe(true)
  })

  it('should return true for llm.token', () => {
    const event: VoiceEvent = { type: 'llm.token', text: 'token' }
    expect(isSystemEvent(event)).toBe(true)
  })

  it('should return true for runtime.error', () => {
    const event: VoiceEvent = { type: 'runtime.error', error: 'failed' }
    expect(isSystemEvent(event)).toBe(true)
  })

  it('should be inverse of isUserEvent', () => {
    const userEvents: VoiceEvent[] = [
      { type: 'session.start' },
      { type: 'audio.commit' },
      { type: 'audio.commit.manual' },
      { type: 'interrupt.request' },
      { type: 'SUBMIT_TEXT', text: 'test' },
    ]

    const systemEvents: VoiceEvent[] = [
      { type: 'asr.partial', text: 'test' },
      { type: 'asr.final', text: 'test' },
      { type: 'llm.token', text: 'token' },
      { type: 'llm.complete', fullText: 'response' },
      { type: 'tts.started' },
      { type: 'tts.complete' },
      { type: 'runtime.error', error: 'fail' },
    ]

    userEvents.forEach(event => {
      expect(isSystemEvent(event)).toBe(false)
    })

    systemEvents.forEach(event => {
      expect(isSystemEvent(event)).toBe(true)
    })
  })
})

describe('type guards', () => {
  it('should access text property through type guard', () => {
    const event: VoiceEvent = { type: 'SUBMIT_TEXT', text: 'hello' }
    if (isUserEvent(event) && 'text' in event) {
      expect(event.text).toBe('hello')
    }
  })

  it('should access fullText property through type guard', () => {
    const event: VoiceEvent = { type: 'llm.complete', fullText: 'response' }
    if (isSystemEvent(event) && 'fullText' in event) {
      expect(event.fullText).toBe('response')
    }
  })
})
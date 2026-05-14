import { describe, it, expect } from 'vitest'
import {
  isUserEvent,
  isSystemEvent,
  type VoiceEvent,
  type UserEvent,
  type SystemEvent
} from './voice-events'

describe('isUserEvent', () => {
  it('should return true for START_RECORDING', () => {
    const event: VoiceEvent = { type: 'START_RECORDING' }
    expect(isUserEvent(event)).toBe(true)
  })

  it('should return true for STOP_RECORDING', () => {
    const event: VoiceEvent = { type: 'STOP_RECORDING' }
    expect(isUserEvent(event)).toBe(true)
  })

  it('should return true for INTERRUPT', () => {
    const event: VoiceEvent = { type: 'INTERRUPT' }
    expect(isUserEvent(event)).toBe(true)
  })

  it('should return true for SUBMIT_TEXT', () => {
    const event: VoiceEvent = { type: 'SUBMIT_TEXT', text: 'hello' }
    expect(isUserEvent(event)).toBe(true)
  })

  it('should return false for ASR_PARTIAL', () => {
    const event: VoiceEvent = { type: 'ASR_PARTIAL', text: 'hello' }
    expect(isUserEvent(event)).toBe(false)
  })

  it('should return false for ASR_FINAL', () => {
    const event: VoiceEvent = { type: 'ASR_FINAL', text: 'hello' }
    expect(isUserEvent(event)).toBe(false)
  })

  it('should return false for LLM_CHUNK', () => {
    const event: VoiceEvent = { type: 'LLM_CHUNK', text: 'hello' }
    expect(isUserEvent(event)).toBe(false)
  })

  it('should return false for LLM_DONE', () => {
    const event: VoiceEvent = { type: 'LLM_DONE', fullText: 'hello' }
    expect(isUserEvent(event)).toBe(false)
  })

  it('should return false for TTS_FINISHED', () => {
    const event: VoiceEvent = { type: 'TTS_FINISHED' }
    expect(isUserEvent(event)).toBe(false)
  })

  it('should return false for ERROR', () => {
    const event: VoiceEvent = { type: 'ERROR', error: 'something' }
    expect(isUserEvent(event)).toBe(false)
  })
})

describe('isSystemEvent', () => {
  it('should return false for START_RECORDING', () => {
    const event: VoiceEvent = { type: 'START_RECORDING' }
    expect(isSystemEvent(event)).toBe(false)
  })

  it('should return true for ASR_PARTIAL', () => {
    const event: VoiceEvent = { type: 'ASR_PARTIAL', text: 'hello' }
    expect(isSystemEvent(event)).toBe(true)
  })

  it('should return true for LLM_CHUNK', () => {
    const event: VoiceEvent = { type: 'LLM_CHUNK', text: 'token' }
    expect(isSystemEvent(event)).toBe(true)
  })

  it('should return true for ERROR', () => {
    const event: VoiceEvent = { type: 'ERROR', error: 'failed' }
    expect(isSystemEvent(event)).toBe(true)
  })

  it('should be inverse of isUserEvent', () => {
    const userEvents: VoiceEvent[] = [
      { type: 'START_RECORDING' },
      { type: 'STOP_RECORDING' },
      { type: 'INTERRUPT' },
      { type: 'SUBMIT_TEXT', text: 'test' }
    ]

    const systemEvents: VoiceEvent[] = [
      { type: 'ASR_PARTIAL', text: 'test' },
      { type: 'ASR_FINAL', text: 'test' },
      { type: 'LLM_CHUNK', text: 'token' },
      { type: 'LLM_DONE', fullText: 'response' },
      { type: 'TTS_FINISHED' },
      { type: 'ERROR', error: 'fail' }
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
  it('should narrow UserEvent type', () => {
    const event: VoiceEvent = { type: 'SUBMIT_TEXT', text: 'hello' }

    if (isUserEvent(event)) {
      expect((event as UserEvent).text).toBe('hello')
    }
  })

  it('should narrow SystemEvent type', () => {
    const event: VoiceEvent = { type: 'LLM_DONE', fullText: 'response' }

    if (isSystemEvent(event)) {
      expect((event as SystemEvent).fullText).toBe('response')
    }
  })
})
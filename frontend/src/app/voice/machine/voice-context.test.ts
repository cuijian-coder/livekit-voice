import { describe, it, expect } from 'vitest'
import {
  createInitialContext,
  createNewRequestId,
  type VoiceContext
} from './voice-context'

describe('createInitialContext', () => {
  it('should create context with default values', () => {
    const context = createInitialContext()

    expect(context.transcript).toBe('')
    expect(context.partialTranscript).toBe('')
    expect(context.streamBuffer).toBe('')
    expect(context.sessionId).toBeDefined()
    expect(context.requestId).toBeDefined()
    expect(context.abortController).toBeUndefined()
    expect(context.error).toBeUndefined()
  })

  it('should generate unique sessionId', () => {
    const context1 = createInitialContext()
    const context2 = createInitialContext()

    expect(context1.sessionId).not.toBe(context2.sessionId)
  })

  it('should generate unique requestId', () => {
    const context1 = createInitialContext()
    const context2 = createInitialContext()

    expect(context1.requestId).not.toBe(context2.requestId)
  })

  it('should generate sessionId with correct prefix', () => {
    const context = createInitialContext()

    expect(context.sessionId).toMatch(/^session-/)
  })

  it('should generate requestId with correct prefix', () => {
    const context = createInitialContext()

    expect(context.requestId).toMatch(/^req-/)
  })

  it('should return VoiceContext type', () => {
    const context = createInitialContext()

    const result: VoiceContext = context
    expect(result.transcript).toBe('')
    expect(result.sessionId).toBeDefined()
  })
})

describe('createNewRequestId', () => {
  it('should generate unique requestId', () => {
    const id1 = createNewRequestId()
    const id2 = createNewRequestId()

    expect(id1).not.toBe(id2)
  })

  it('should generate requestId with correct prefix', () => {
    const id = createNewRequestId()

    expect(id).toMatch(/^req-/)
  })

  it('should generate requestId with timestamp', () => {
    const id = createNewRequestId()

    // ID should contain numbers
    expect(id).toMatch(/\d+/)
  })
})
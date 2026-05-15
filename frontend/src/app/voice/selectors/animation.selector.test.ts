import { describe, it, expect } from 'vitest'
import { selectAnimation } from './animation.selector'

const createSnapshot = (state: string) => ({
  value: state,
  context: {
    requestId: 'req-123',
    transcript: '',
    partialTranscript: '',
    streamBuffer: '',
    sessionId: 'sess-1',
    turnId: '',
    abortController: undefined,
    error: undefined,
  },
})

describe('selectAnimation', () => {
  it('should return pulse for listening state', () => {
    const snapshot = createSnapshot('listening')
    const result = selectAnimation(snapshot)
    expect(result.type).toBe('pulse')
  })

  it('should return spin for thinking state', () => {
    const snapshot = createSnapshot('thinking')
    const result = selectAnimation(snapshot)
    expect(result.type).toBe('spin')
  })

  it('should return wave for speaking state', () => {
    const snapshot = createSnapshot('speaking')
    const result = selectAnimation(snapshot)
    expect(result.type).toBe('wave')
  })

  it('should return wave for transcribing state', () => {
    const snapshot = createSnapshot('transcribing')
    const result = selectAnimation(snapshot)
    expect(result.type).toBe('wave')
  })

  it('should return none for idle state', () => {
    const snapshot = createSnapshot('idle')
    const result = selectAnimation(snapshot)
    expect(result.type).toBe('none')
  })

  it('should return none for error state', () => {
    const snapshot = createSnapshot('error')
    const result = selectAnimation(snapshot)
    expect(result.type).toBe('none')
  })
})
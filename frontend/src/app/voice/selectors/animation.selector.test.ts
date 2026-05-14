import { describe, it, expect } from 'vitest'
import { selectAnimation, type AnimationViewModel } from './animation.selector'

const createSnapshot = (state: string) => ({
  value: state,
  context: {
    requestId: 'req-123',
    transcript: '',
    partialTranscript: '',
    streamBuffer: '',
    sessionId: 'sess-1',
    abortController: undefined,
    error: undefined
  }
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

  it('should return wave for streaming state', () => {
    const snapshot = createSnapshot('streaming')
    const result = selectAnimation(snapshot)

    expect(result.type).toBe('wave')
  })

  it('should return none for idle state', () => {
    const snapshot = createSnapshot('idle')
    const result = selectAnimation(snapshot)

    expect(result.type).toBe('none')
  })

  it('should return none for playing state', () => {
    const snapshot = createSnapshot('playing')
    const result = selectAnimation(snapshot)

    expect(result.type).toBe('none')
  })

  it('should return none for error state', () => {
    const snapshot = createSnapshot('error')
    const result = selectAnimation(snapshot)

    expect(result.type).toBe('none')
  })
})
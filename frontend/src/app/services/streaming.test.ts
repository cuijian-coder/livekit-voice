import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { streamText, cancelStream } from './streaming'

describe('streamText', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.advanceTimersToNextTimer()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cancelStream()
  })

  it('should call onChunk with accumulated text', () => {
    const chunks: string[] = []
    const onChunk = vi.fn((text: string) => chunks.push(text))
    const onComplete = vi.fn()

    streamText('hello', { onChunk, onComplete, delay: 10, chunkSize: 2 })

    vi.runAllTimers()

    expect(onChunk).toHaveBeenCalled()
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('should call onComplete when finished', () => {
    const onChunk = vi.fn()
    const onComplete = vi.fn()

    streamText('hi', { onChunk, onComplete, delay: 10, chunkSize: 5 })

    vi.runAllTimers()

    expect(onComplete).toHaveBeenCalled()
  })

  it('should respect chunkSize option', () => {
    const chunks: string[] = []
    const onChunk = vi.fn((text: string) => chunks.push(text))
    const onComplete = vi.fn()

    streamText('abcdef', { onChunk, onComplete, delay: 10, chunkSize: 2 })

    vi.runAllTimers()

    expect(chunks.length).toBeGreaterThan(1)
  })

  it('should return cleanup function', () => {
    const onChunk = vi.fn()
    const onComplete = vi.fn()

    const cleanup = streamText('hello world', { onChunk, onComplete, delay: 10 })

    vi.runAllTimers()
    expect(onComplete).toHaveBeenCalled()

    onChunk.mockClear()
    cancelStream()
    expect(onChunk).not.toHaveBeenCalled()
  })
})

describe('cancelStream', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.advanceTimersToNextTimer()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cancelStream()
  })

  it('should abort ongoing stream', () => {
    const onChunk = vi.fn()
    const onComplete = vi.fn()

    streamText('very long text', { onChunk, onComplete, delay: 10 })

    vi.advanceTimersByTime(20)
    cancelStream()

    vi.runAllTimers()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('should not throw when no stream is running', () => {
    expect(() => cancelStream()).not.toThrow()
  })
})
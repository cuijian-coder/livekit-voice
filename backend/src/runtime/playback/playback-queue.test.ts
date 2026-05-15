import { describe, it, expect } from 'vitest'
import { PlaybackQueue } from './playback-queue'

describe('PlaybackQueue', () => {
  it('should enqueue and drain in FIFO order', () => {
    const queue = new PlaybackQueue()
    queue.enqueue(Buffer.from('a'))
    queue.enqueue(Buffer.from('b'))
    queue.enqueue(Buffer.from('c'))

    expect(queue.drain()?.toString()).toBe('a')
    expect(queue.drain()?.toString()).toBe('b')
    expect(queue.drain()?.toString()).toBe('c')
    expect(queue.isEmpty()).toBe(true)
  })

  it('should return null on empty drain', () => {
    const queue = new PlaybackQueue()
    expect(queue.drain()).toBeNull()
  })

  it('should clear all items', () => {
    const queue = new PlaybackQueue()
    queue.enqueue(Buffer.from('a'))
    queue.enqueue(Buffer.from('b'))
    queue.clear()
    expect(queue.isEmpty()).toBe(true)
    expect(queue.drain()).toBeNull()
  })

  it('should track size', () => {
    const queue = new PlaybackQueue()
    expect(queue.size()).toBe(0)
    queue.enqueue(Buffer.from('a'))
    expect(queue.size()).toBe(1)
    queue.enqueue(Buffer.from('b'))
    expect(queue.size()).toBe(2)
    queue.drain()
    expect(queue.size()).toBe(1)
  })

  it('should count underruns on drain from empty queue', () => {
    const queue = new PlaybackQueue()
    expect(queue.underrunCount).toBe(0)
    queue.drain()
    expect(queue.underrunCount).toBe(1)
    queue.drain()
    expect(queue.underrunCount).toBe(2)
  })

  it('should not count underrun when items exist but are drained', () => {
    const queue = new PlaybackQueue()
    queue.enqueue(Buffer.from('a'))
    queue.drain()
    expect(queue.underrunCount).toBe(0)
    queue.drain()
    expect(queue.underrunCount).toBe(1)
  })

  it('should reset underrun count', () => {
    const queue = new PlaybackQueue()
    queue.drain()
    queue.drain()
    expect(queue.underrunCount).toBe(2)
    queue.resetUnderrunCount()
    expect(queue.underrunCount).toBe(0)
  })

  it('should survive clear during drain', () => {
    const queue = new PlaybackQueue()
    queue.enqueue(Buffer.from('a'))
    queue.enqueue(Buffer.from('b'))
    expect(queue.drain()?.toString()).toBe('a')
    queue.clear()
    expect(queue.drain()).toBeNull()
    expect(queue.isEmpty()).toBe(true)
  })
})
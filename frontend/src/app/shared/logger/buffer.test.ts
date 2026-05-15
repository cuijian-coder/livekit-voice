import { describe, it, expect, beforeEach } from 'vitest'
import { LogBuffer } from './buffer'
import type { LogEvent, LogLevel } from './types'

describe('LogBuffer', () => {
  let buffer: LogBuffer

  beforeEach(() => {
    buffer = new LogBuffer()
  })

  it('should add entry to buffer', () => {
    const entry: LogEvent = {
      id: '1',
      timestamp: Date.now(),
      level: 'info' as LogLevel,
      event: 'test',
      data: { foo: 'bar' }
    }
    buffer.add(entry)
    expect(buffer.getAll()).toHaveLength(1)
  })

  it('should return all entries', () => {
    buffer.add({ id: '1', timestamp: 1, level: 'info', event: 'a' })
    buffer.add({ id: '2', timestamp: 2, level: 'debug', event: 'b' })
    const entries = buffer.getAll()
    expect(entries).toHaveLength(2)
    expect(entries[0].event).toBe('a')
    expect(entries[1].event).toBe('b')
  })

  it('should remove oldest entry when exceeding 200 entries', () => {
    for (let i = 0; i < 201; i++) {
      buffer.add({ id: String(i), timestamp: i, level: 'info', event: `event-${i}` })
    }
    const entries = buffer.getAll()
    expect(entries).toHaveLength(200)
    expect(entries[0].id).toBe('1')
  })

  it('should clear all entries', () => {
    buffer.add({ id: '1', timestamp: 1, level: 'info', event: 'test' })
    buffer.clear()
    expect(buffer.getAll()).toHaveLength(0)
  })

  it('should return copy of entries', () => {
    buffer.add({ id: '1', timestamp: 1, level: 'info', event: 'test' })
    const entries = buffer.getAll()
    entries.push({ id: '999', timestamp: 999, level: 'error', event: 'external' })
    expect(buffer.getAll()).toHaveLength(1)
  })
})
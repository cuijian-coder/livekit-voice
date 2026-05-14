import { describe, it, expect } from 'vitest'
import { formatTime, formatDuration } from './time'

describe('formatTime', () => {
  it('should format timestamp to time string', () => {
    const timestamp = new Date('2024-01-01T14:30:00').getTime()
    const result = formatTime(timestamp)

    expect(result).toMatch(/\d{1,2}:\d{2}/)
    expect(result).toContain('30')
  })

  it('should include hours and minutes', () => {
    const timestamp = new Date('2024-01-01T09:05:00').getTime()
    const result = formatTime(timestamp)

    expect(result).toMatch(/\d{2}:\d{2}/)
  })

  it('should format morning times', () => {
    const timestamp = new Date('2024-01-01T08:00:00').getTime()
    const result = formatTime(timestamp)

    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('should format afternoon times', () => {
    const timestamp = new Date('2024-01-01T18:45:00').getTime()
    const result = formatTime(timestamp)

    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('should pad minutes with zero', () => {
    const timestamp = new Date('2024-01-01T14:05:00').getTime()
    const result = formatTime(timestamp)

    expect(result).toContain('05')
  })
})

describe('formatDuration', () => {
  it('should format 0 seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('should format seconds only', () => {
    expect(formatDuration(45)).toBe('0:45')
  })

  it('should format minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1:30')
  })

  it('should format multiple minutes', () => {
    expect(formatDuration(300)).toBe('5:00')
  })

  it('should format large duration', () => {
    expect(formatDuration(3661)).toBe('61:01')
  })

  it('should pad seconds with zero', () => {
    expect(formatDuration(65)).toBe('1:05')
  })

  it('should handle exactly one minute', () => {
    expect(formatDuration(60)).toBe('1:00')
  })

  it('should pad single digit minutes', () => {
    expect(formatDuration(125)).toBe('2:05')
  })
})
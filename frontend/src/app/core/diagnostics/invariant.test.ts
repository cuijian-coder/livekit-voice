import { describe, it, expect, vi } from 'vitest'
import { invariant } from './invariant'

describe('invariant', () => {
  it('should not throw when condition is true', () => {
    expect(() => invariant(true, 'should not throw')).not.toThrow()
  })

  it('should throw or warn when condition is false', () => {
    expect(() => invariant(false, 'test error')).toThrow()
  })

  it('should throw error with custom message', () => {
    expect(() => invariant(false, 'custom message')).toThrow('custom message')
  })

  it('should include context in logger call', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => invariant(false, 'test error', { foo: 'bar' })).toThrow()
      // Verify logger was called with context
      expect(consoleSpy).toHaveBeenCalled()
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('should handle complex context object', () => {
    const context = { state: 'playing', requestId: 'req-123', count: 42 }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => invariant(false, 'test', context)).toThrow()
      expect(consoleSpy).toHaveBeenCalled()
    } finally {
      consoleSpy.mockRestore()
    }
  })

  describe('assertion type narrowing', () => {
    it('should narrow string | null to string after check', () => {
      const value: string | null = 'test'
      invariant(!!value, 'value should not be null')
      // After invariant, TypeScript knows value is string
      expect(value.length).toBe(4)
    })

    it('should narrow undefined | object to object after check', () => {
      const value: undefined | { foo: string } = { foo: 'bar' }
      invariant(!!value, 'value should not be undefined')
      expect(value.foo).toBe('bar')
    })
  })
})
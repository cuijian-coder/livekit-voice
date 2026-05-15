import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Logger } from './logger'

describe('Logger', () => {
  let logger: Logger

  beforeEach(() => {
    logger = new Logger()
    logger.clear()
  })

  describe('debug', () => {
    it('should add debug log with correct level', () => {
      logger.debug('test.event', { foo: 'bar' })
      const logs = logger.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe('debug')
      expect(logs[0].event).toBe('test.event')
      expect(logs[0].data).toEqual({ foo: 'bar' })
    })
  })

  describe('info', () => {
    it('should add info log with correct level', () => {
      logger.info('test.event', { foo: 'bar' })
      const logs = logger.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe('info')
      expect(logs[0].event).toBe('test.event')
    })
  })

  describe('warn', () => {
    it('should add warn log with correct level', () => {
      logger.warn('test.event', { foo: 'bar' })
      const logs = logger.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe('warn')
    })
  })

  describe('error', () => {
    it('should add error log with correct level', () => {
      logger.error('test.event', { error: 'something went wrong' })
      const logs = logger.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe('error')
    })
  })

  describe('log structure', () => {
    it('should include id in log entry', () => {
      logger.info('test')
      const logs = logger.getLogs()
      expect(logs[0].id).toBeDefined()
      expect(typeof logs[0].id).toBe('string')
    })

    it('should include timestamp in log entry', () => {
      const before = Date.now()
      logger.info('test')
      const after = Date.now()
      const logs = logger.getLogs()
      expect(logs[0].timestamp).toBeGreaterThanOrEqual(before)
      expect(logs[0].timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('requestId', () => {
    it('should set requestId', () => {
      logger.setRequestId('req-123')
      logger.info('test')
      const logs = logger.getLogs()
      expect(logs[0].requestId).toBe('req-123')
    })

    it('should include requestId in subsequent logs', () => {
      logger.setRequestId('req-456')
      logger.info('event1')
      logger.info('event2')
      const logs = logger.getLogs()
      expect(logs[0].requestId).toBe('req-456')
      expect(logs[1].requestId).toBe('req-456')
    })
  })

  describe('clear', () => {
    it('should clear all logs', () => {
      logger.info('test1')
      logger.info('test2')
      logger.clear()
      expect(logger.getLogs()).toHaveLength(0)
    })
  })

  describe('getLogs', () => {
    it('should return copy of logs', () => {
      logger.info('test')
      const logs = logger.getLogs()
      logs.push({ id: '999', timestamp: 999, level: 'error', event: 'external' })
      expect(logger.getLogs()).toHaveLength(1)
    })
  })
})
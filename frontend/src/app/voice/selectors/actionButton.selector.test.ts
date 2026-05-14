import { describe, it, expect } from 'vitest'
import { selectActionButton, type ButtonViewModel } from './actionButton.selector'

const createSnapshot = (state: string, error?: string) => ({
  value: state,
  context: {
    requestId: 'req-123',
    transcript: '',
    partialTranscript: '',
    streamBuffer: '',
    sessionId: 'sess-1',
    abortController: undefined,
    error: error
  }
})

describe('selectActionButton', () => {
  describe('idle state', () => {
    it('should return record button when no input and no error', () => {
      const snapshot = createSnapshot('idle')
      const result = selectActionButton(snapshot, false)

      expect(result.semantic).toBe('record')
      expect(result.disabled).toBe(false)
    })

    it('should return send button when has input', () => {
      const snapshot = createSnapshot('idle')
      const result = selectActionButton(snapshot, true)

      expect(result.semantic).toBe('send')
      expect(result.disabled).toBe(false)
    })

    it('should return disabled button when has error', () => {
      const snapshot = createSnapshot('idle', 'some error')
      const result = selectActionButton(snapshot, false)

      expect(result.semantic).toBe('disabled')
      expect(result.disabled).toBe(true)
    })
  })

  describe('listening state', () => {
    it('should return stop-recording button', () => {
      const snapshot = createSnapshot('listening')
      const result = selectActionButton(snapshot, false)

      expect(result.semantic).toBe('stop-recording')
      expect(result.pulse).toBe(true)
      expect(result.disabled).toBe(false)
    })

    it('should return send if has input even in listening', () => {
      const snapshot = createSnapshot('listening')
      const result = selectActionButton(snapshot, true)

      expect(result.semantic).toBe('send')
    })
  })

  describe('thinking state', () => {
    it('should return interrupt button', () => {
      const snapshot = createSnapshot('thinking')
      const result = selectActionButton(snapshot, false)

      expect(result.semantic).toBe('interrupt')
      expect(result.disabled).toBe(false)
    })

    it('should return disabled for send when processing', () => {
      const snapshot = createSnapshot('thinking')
      const result = selectActionButton(snapshot, true)

      expect(result.semantic).toBe('send')
      expect(result.disabled).toBe(true)
    })
  })

  describe('streaming state', () => {
    it('should return interrupt button', () => {
      const snapshot = createSnapshot('streaming')
      const result = selectActionButton(snapshot, false)

      expect(result.semantic).toBe('interrupt')
      expect(result.disabled).toBe(false)
    })
  })

  describe('playing state', () => {
    it('should return interrupt button', () => {
      const snapshot = createSnapshot('playing')
      const result = selectActionButton(snapshot, false)

      expect(result.semantic).toBe('interrupt')
      expect(result.disabled).toBe(false)
    })
  })

  describe('error state', () => {
    it('should return disabled button', () => {
      const snapshot = createSnapshot('error', 'some error')
      const result = selectActionButton(snapshot, false)

      expect(result.semantic).toBe('disabled')
      expect(result.disabled).toBe(true)
    })
  })
})
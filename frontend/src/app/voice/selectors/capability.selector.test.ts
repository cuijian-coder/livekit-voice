import { describe, it, expect } from 'vitest'
import { selectCapabilities, type VoiceCapabilities } from './capability.selector'

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

describe('selectCapabilities', () => {
  describe('canRecord', () => {
    it('should allow recording in idle with no input', () => {
      const snapshot = createSnapshot('idle')
      const result = selectCapabilities(snapshot, false)

      expect(result.canRecord).toBe(true)
    })

    it('should not allow recording when has input', () => {
      const snapshot = createSnapshot('idle')
      const result = selectCapabilities(snapshot, true)

      expect(result.canRecord).toBe(false)
    })

    it('should not allow recording in listening state', () => {
      const snapshot = createSnapshot('listening')
      const result = selectCapabilities(snapshot, false)

      expect(result.canRecord).toBe(false)
    })

    it('should not allow recording when has error', () => {
      const snapshot = createSnapshot('idle', 'error')
      const result = selectCapabilities(snapshot, false)

      expect(result.canRecord).toBe(false)
    })
  })

  describe('canInterrupt', () => {
    it('should allow interrupt in thinking state', () => {
      const snapshot = createSnapshot('thinking')
      const result = selectCapabilities(snapshot, false)

      expect(result.canInterrupt).toBe(true)
    })

    it('should allow interrupt in streaming state', () => {
      const snapshot = createSnapshot('streaming')
      const result = selectCapabilities(snapshot, false)

      expect(result.canInterrupt).toBe(true)
    })

    it('should allow interrupt in playing state', () => {
      const snapshot = createSnapshot('playing')
      const result = selectCapabilities(snapshot, false)

      expect(result.canInterrupt).toBe(true)
    })

    it('should not allow interrupt in idle state', () => {
      const snapshot = createSnapshot('idle')
      const result = selectCapabilities(snapshot, false)

      expect(result.canInterrupt).toBe(false)
    })

    it('should not allow interrupt when has error', () => {
      const snapshot = createSnapshot('thinking', 'error')
      const result = selectCapabilities(snapshot, false)

      expect(result.canInterrupt).toBe(false)
    })
  })

  describe('canSubmitText', () => {
    it('should allow submit when has input and not processing', () => {
      const snapshot = createSnapshot('idle')
      const result = selectCapabilities(snapshot, true)

      expect(result.canSubmitText).toBe(true)
    })

    it('should not allow submit when no input', () => {
      const snapshot = createSnapshot('idle')
      const result = selectCapabilities(snapshot, false)

      expect(result.canSubmitText).toBe(false)
    })

    it('should not allow submit when processing', () => {
      const snapshot = createSnapshot('thinking')
      const result = selectCapabilities(snapshot, true)

      expect(result.canSubmitText).toBe(false)
    })

    it('should not allow submit when has error', () => {
      const snapshot = createSnapshot('idle', 'error')
      const result = selectCapabilities(snapshot, true)

      expect(result.canSubmitText).toBe(false)
    })
  })

  describe('canMute', () => {
    it('should allow mute in listening state', () => {
      const snapshot = createSnapshot('listening')
      const result = selectCapabilities(snapshot, false)

      expect(result.canMute).toBe(true)
    })

    it('should not allow mute in idle state', () => {
      const snapshot = createSnapshot('idle')
      const result = selectCapabilities(snapshot, false)

      expect(result.canMute).toBe(false)
    })
  })

  describe('isDisabled', () => {
    it('should be disabled when has error', () => {
      const snapshot = createSnapshot('idle', 'error')
      const result = selectCapabilities(snapshot, false)

      expect(result.isDisabled).toBe(true)
    })

    it('should be disabled when processing', () => {
      const snapshot = createSnapshot('thinking')
      const result = selectCapabilities(snapshot, false)

      expect(result.isDisabled).toBe(true)
    })

    it('should not be disabled in idle with no error', () => {
      const snapshot = createSnapshot('idle')
      const result = selectCapabilities(snapshot, false)

      expect(result.isDisabled).toBe(false)
    })
  })
})
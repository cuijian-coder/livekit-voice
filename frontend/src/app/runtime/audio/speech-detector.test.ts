import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SpeechDetector } from './speech-detector'

describe('SpeechDetector', () => {
  const createFloat32Data = (samples: number, value: number = 0): Float32Array => {
    const data = new Float32Array(samples)
    data.fill(value)
    return data
  }

  const createSpeechData = (samples: number): Float32Array => {
    const data = new Float32Array(samples)
    for (let i = 0; i < samples; i++) {
      data[i] = Math.sin(i * 0.1) * 0.05
    }
    return data
  }

  describe('initialization', () => {
    it('should start in IDLE state', () => {
      const detector = new SpeechDetector()
      expect(detector.getState()).toBe('IDLE')
    })

    it('should use default config values', () => {
      const detector = new SpeechDetector()
      detector.onFrame(createFloat32Data(128, 0.001))
      expect(detector.getState()).toBe('IDLE')
    })

    it('should accept custom config', () => {
      const detector = new SpeechDetector({
        energyThreshold: 0.05,
        silenceTimeoutMs: 1000,
        minSpeechDurationMs: 500,
      })
      expect(detector.getState()).toBe('IDLE')
    })
  })

  describe('IDLE state', () => {
    it('should transition to SPEAKING when energy exceeds threshold', () => {
      const detector = new SpeechDetector()
      const speechData = createSpeechData(128)
      const result = detector.onFrame(speechData)
      expect(result).toBe('SPEAKING')
      expect(detector.getState()).toBe('SPEAKING')
    })

    it('should stay in IDLE when energy below threshold', () => {
      const detector = new SpeechDetector()
      const quietData = createFloat32Data(128, 0.001)
      detector.onFrame(quietData)
      expect(detector.getState()).toBe('IDLE')
    })
  })

  describe('SPEAKING state', () => {
    it('should stay in SPEAKING while energy above threshold', () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)

      const detector = new SpeechDetector()
      const speechData = createSpeechData(128)

      detector.onFrame(speechData)
      expect(detector.getState()).toBe('SPEAKING')

      vi.advanceTimersByTime(50)
      const result = detector.onFrame(speechData)
      expect(result).toBe('SPEAKING')
      expect(detector.getState()).toBe('SPEAKING')

      vi.useRealTimers()
    })

    it('should transition to POSSIBLE_END after silence timeout', () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)

      const detector = new SpeechDetector({
        silenceTimeoutMs: 100,
        minSpeechDurationMs: 50,
      })

      const speechData = createSpeechData(128)

      detector.onFrame(speechData)
      expect(detector.getState()).toBe('SPEAKING')

      vi.advanceTimersByTime(30)
      detector.onFrame(speechData)

      vi.advanceTimersByTime(30)
      detector.onFrame(speechData)

      expect(detector.getState()).toBe('SPEAKING')

      vi.advanceTimersByTime(150)

      const quietData = createFloat32Data(128, 0.001)
      const result = detector.onFrame(quietData)

      expect(result).toBe('POSSIBLE_END')
      expect(detector.getState()).toBe('POSSIBLE_END')

      vi.useRealTimers()
    })

    it('should transition to IDLE if speech too short', () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)

      const detector = new SpeechDetector({
        silenceTimeoutMs: 100,
        minSpeechDurationMs: 500,
      })

      const speechData = createSpeechData(128)
      detector.onFrame(speechData)

      vi.advanceTimersByTime(200)

      const quietData = createFloat32Data(128, 0.001)
      const result = detector.onFrame(quietData)

      expect(result).toBe('IDLE')
      expect(detector.getState()).toBe('IDLE')

      vi.useRealTimers()
    })
  })

  describe('POSSIBLE_END state', () => {
    it('should transition back to SPEAKING if speech resumes', () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)

      const detector = new SpeechDetector({
        silenceTimeoutMs: 100,
        minSpeechDurationMs: 50,
      })

      const speechData = createSpeechData(128)
      detector.onFrame(speechData)

      vi.advanceTimersByTime(30)
      detector.onFrame(speechData)

      vi.advanceTimersByTime(30)
      detector.onFrame(speechData)

      vi.advanceTimersByTime(150)

      const quietData = createFloat32Data(128, 0.001)
      detector.onFrame(quietData)
      expect(detector.getState()).toBe('POSSIBLE_END')

      const result = detector.onFrame(speechData)
      expect(result).toBe('SPEAKING')
      expect(detector.getState()).toBe('SPEAKING')

      vi.useRealTimers()
    })

    it('should stay in POSSIBLE_END while silence continues', () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)

      const detector = new SpeechDetector({
        silenceTimeoutMs: 100,
        minSpeechDurationMs: 50,
      })

      const speechData = createSpeechData(128)
      detector.onFrame(speechData)

      vi.advanceTimersByTime(30)
      detector.onFrame(speechData)

      vi.advanceTimersByTime(30)
      detector.onFrame(speechData)

      vi.advanceTimersByTime(150)

      const quietData = createFloat32Data(128, 0.001)
      detector.onFrame(quietData)
      expect(detector.getState()).toBe('POSSIBLE_END')

      const result = detector.onFrame(quietData)
      expect(result).toBe('POSSIBLE_END')

      vi.useRealTimers()
    })
  })

  describe('interruption detection', () => {
    it('should transition to INTERRUPTING when user speaks during assistant speech', () => {
      const detector = new SpeechDetector()
      const speechData = createSpeechData(128)

      detector.onFrame(speechData)
      expect(detector.getState()).toBe('SPEAKING')

      detector.setAssistantSpeaking(true)

      const result = detector.onFrame(speechData)
      expect(result).toBe('INTERRUPTING')
      expect(detector.getState()).toBe('INTERRUPTING')
    })

    it('should not trigger interruption if not assistant speaking', () => {
      const detector = new SpeechDetector()
      const speechData = createSpeechData(128)

      detector.onFrame(speechData)
      expect(detector.getState()).toBe('SPEAKING')

      detector.setAssistantSpeaking(false)

      const result = detector.onFrame(speechData)
      expect(result).toBe('SPEAKING')
      expect(detector.getState()).toBe('SPEAKING')
    })

    it('should not trigger interruption in IDLE state', () => {
      const detector = new SpeechDetector()
      const speechData = createSpeechData(128)

      detector.setAssistantSpeaking(true)

      const result = detector.onFrame(speechData)
      expect(result).toBe('SPEAKING')
      expect(detector.getState()).toBe('SPEAKING')
    })
  })

  describe('reset', () => {
    it('should reset state to IDLE', () => {
      const detector = new SpeechDetector()
      const speechData = createSpeechData(128)

      detector.onFrame(speechData)
      expect(detector.getState()).toBe('SPEAKING')

      detector.reset()
      expect(detector.getState()).toBe('IDLE')
    })

    it('should reset even in INTERRUPTING state', () => {
      const detector = new SpeechDetector()
      const speechData = createSpeechData(128)

      detector.onFrame(speechData)
      detector.setAssistantSpeaking(true)
      detector.onFrame(speechData)
      expect(detector.getState()).toBe('INTERRUPTING')

      detector.reset()
      expect(detector.getState()).toBe('IDLE')
    })
  })

  describe('state change handler', () => {
    it('should call handler on state change', () => {
      const handler = vi.fn()
      const detector = new SpeechDetector()
      detector.setStateChangeHandler(handler)

      const speechData = createSpeechData(128)
      detector.onFrame(speechData)

      expect(handler).toHaveBeenCalledWith('SPEAKING')
    })

    it('should not call handler on same state', () => {
      const handler = vi.fn()
      const detector = new SpeechDetector()
      detector.setStateChangeHandler(handler)

      const speechData = createSpeechData(128)
      detector.onFrame(speechData)
      detector.onFrame(speechData)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})
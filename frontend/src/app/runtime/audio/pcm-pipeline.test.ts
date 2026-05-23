import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock modules with browser-only side effects before importing test targets
vi.mock('../../runtime/transport', () => ({
  binaryTransport: {
    sendFrame: vi.fn(),
    startTurn: vi.fn(),
    commit: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
  }
}))

vi.mock('./speech-detector', async () => {
  return {
    speechDetector: {
      onFrame: vi.fn().mockReturnValue('SPEAKING'),
      getState: vi.fn().mockReturnValue('IDLE'),
      reset: vi.fn(),
      setStateChangeHandler: vi.fn(),
      setAssistantSpeaking: vi.fn(),
    },
    SpeechState: {}
  }
})

vi.mock('../../../../../self-healing/assert', () => ({
  invariant: vi.fn(),
  assertNotNull: vi.fn((v: any) => v),
}))

import { PcmPipeline } from './pcm-pipeline'
import { binaryTransport } from '../../runtime/transport'
import { speechDetector } from './speech-detector'

describe('PcmPipeline', () => {
  let pipeline: PcmPipeline

  beforeEach(() => {
    vi.clearAllMocks()
    pipeline = new PcmPipeline()
    vi.mocked(speechDetector.onFrame).mockReturnValue('SPEAKING')
  })

  it('should reset currentSeq to 0 after reset()', () => {
    // Process some frames to increment seq
    pipeline.processWorkletFrame(0, new Float32Array(320))
    pipeline.processWorkletFrame(1, new Float32Array(320))

    expect(binaryTransport.sendFrame).toHaveBeenCalledTimes(2)
    expect(vi.mocked(binaryTransport.sendFrame).mock.calls[0][0].seq).toBe(0)
    expect(vi.mocked(binaryTransport.sendFrame).mock.calls[1][0].seq).toBe(1)

    // Reset
    pipeline.reset()

    // After reset, seq should start from 0 again
    pipeline.processWorkletFrame(0, new Float32Array(320))
    expect(vi.mocked(binaryTransport.sendFrame).mock.calls[2][0].seq).toBe(0)
  })

  it('should use provided seq if >= 0, otherwise auto-increment', () => {
    pipeline.processWorkletFrame(5, new Float32Array(320))
    expect(vi.mocked(binaryTransport.sendFrame).mock.calls[0][0].seq).toBe(5)

    // With negative seq (auto-increment path)
    pipeline.processTestFrame(new Float32Array(320))
    expect(vi.mocked(binaryTransport.sendFrame).mock.calls[1][0].seq).toBe(0)

    pipeline.processTestFrame(new Float32Array(320))
    expect(vi.mocked(binaryTransport.sendFrame).mock.calls[2][0].seq).toBe(1)
  })

  it('should not send frames when VAD is IDLE', () => {
    vi.mocked(speechDetector.onFrame).mockReturnValue('IDLE')
    pipeline.processWorkletFrame(0, new Float32Array(320))
    expect(binaryTransport.sendFrame).not.toHaveBeenCalled()
  })

  it('should pre-roll buffer frames while IDLE and flush on SPEAKING', () => {
    let callCount = 0
    vi.mocked(speechDetector.onFrame).mockImplementation(() => {
      callCount++
      return callCount <= 3 ? 'IDLE' : 'SPEAKING'
    })

    // Send 3 IDLE frames
    pipeline.processWorkletFrame(0, new Float32Array(320))
    pipeline.processWorkletFrame(1, new Float32Array(320))
    pipeline.processWorkletFrame(2, new Float32Array(320))

    expect(binaryTransport.sendFrame).not.toHaveBeenCalled()

    // 4th frame triggers SPEAKING - flushes pre-roll + sends current
    pipeline.processWorkletFrame(3, new Float32Array(320))
    expect(binaryTransport.sendFrame).toHaveBeenCalledTimes(4)
  })

  it('should clear pre-roll on POSSIBLE_END', () => {
    vi.mocked(speechDetector.onFrame).mockReturnValue('IDLE')
    pipeline.processWorkletFrame(0, new Float32Array(320))
    pipeline.processWorkletFrame(1, new Float32Array(320))

    vi.mocked(speechDetector.onFrame).mockReturnValue('POSSIBLE_END')
    pipeline.processWorkletFrame(2, new Float32Array(320))

    vi.mocked(speechDetector.onFrame).mockReturnValue('SPEAKING')
    pipeline.processWorkletFrame(3, new Float32Array(320))

    // Only current frame should be sent (pre-roll cleared)
    expect(binaryTransport.sendFrame).toHaveBeenCalledTimes(1)
    expect(vi.mocked(binaryTransport.sendFrame).mock.calls[0][0].seq).toBe(3)
  })

  it('should maintain seq continuity across multiple turns after reset', () => {
    // Turn 1: frames 0-4
    for (let i = 0; i < 5; i++) {
      pipeline.processWorkletFrame(i, new Float32Array(320))
    }
    expect(binaryTransport.sendFrame).toHaveBeenCalledTimes(5)

    // Reset
    pipeline.reset()

    // Turn 2: seq starts from 0
    for (let i = 0; i < 3; i++) {
      pipeline.processWorkletFrame(i, new Float32Array(320))
    }

    const allCalls = vi.mocked(binaryTransport.sendFrame).mock.calls
    const turn2Calls = allCalls.slice(5)
    expect(turn2Calls.length).toBe(3)
    expect(turn2Calls[0][0].seq).toBe(0)
    expect(turn2Calls[1][0].seq).toBe(1)
    expect(turn2Calls[2][0].seq).toBe(2)
  })
})

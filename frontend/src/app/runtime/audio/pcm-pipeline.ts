import { getLogger } from '@livekit-voice/shared/logger'
import { speechDetector, type SpeechState } from './speech-detector'
import { binaryTransport } from '../transport'

const logger = getLogger()

export interface PcmFrame {
  seq: number
  samples: Float32Array
  sampleRate: number
  timestamp: number
  source: 'worklet' | 'test-injection'
}

interface CachedFrame {
  seq: number
  pcm: Uint8Array
}

export class PcmPipeline {
  private currentSeq = 0

  private diagnostics = {
    injectFrames: 0,
    pcmFramesProcessed: 0,
    vadFramesProcessed: 0,
    transportFramesSent: 0,
    lastStage: 'idle' as string,
    lastSource: 'worklet' as string,
    lastVadState: 'IDLE' as string
  }

  /**
   * Pre-roll ring buffer: cache frames while VAD is IDLE.
   * Flushed to transport on first SPEAKING transition.
   * ~500ms @ 20ms/frame = 25 frames.
   */
  private preRollBuffer: CachedFrame[] = []
  private readonly PRE_ROLL_MAX_FRAMES = 25
  private prevVadState: SpeechState = 'IDLE'

  /**
   * CANONICAL ENTRY POINT - All PCM sources flow through this method
   * @param frame - PcmFrame from any source (worklet, test, replay)
   */
  processFrame(frame: PcmFrame): void {
    const seq = frame.seq >= 0 ? frame.seq : this.currentSeq++

    this.diagnostics.injectFrames++
    this.diagnostics.pcmFramesProcessed++
    this.diagnostics.lastSource = frame.source
    this.diagnostics.lastStage = 'pcm'

    const vadState = speechDetector.onFrame(frame.samples)
    this.diagnostics.lastVadState = vadState
    this.diagnostics.vadFramesProcessed++
    this.diagnostics.lastStage = 'vad'

    const pcmData = this.float32ToInt16(frame.samples)

    if (vadState === 'SPEAKING') {
      if (this.prevVadState !== 'SPEAKING') {
        // First real speech detected — flush pre-roll so ASR has context
        this.flushPreRoll()
      }
      this.sendFrame(seq, pcmData)
    } else if (vadState === 'POSSIBLE_END' || vadState === 'INTERRUPTING') {
      // Silence / interruption: discard cached frames, do not send silence
      this.clearPreRoll()
    } else {
      // IDLE: buffer for pre-roll context, do not push yet
      this.addToPreRoll(seq, pcmData)
    }

    this.prevVadState = vadState
  }

  private sendFrame(seq: number, pcm: Uint8Array): void {
    binaryTransport.sendFrame({ seq, pcm })
    this.diagnostics.transportFramesSent++
    this.diagnostics.lastStage = 'transport'
  }

  private addToPreRoll(seq: number, pcm: Uint8Array): void {
    this.preRollBuffer.push({ seq, pcm })
    if (this.preRollBuffer.length > this.PRE_ROLL_MAX_FRAMES) {
      this.preRollBuffer.shift()
    }
  }

  private flushPreRoll(): void {
    for (const cached of this.preRollBuffer) {
      this.sendFrame(cached.seq, cached.pcm)
    }
    this.preRollBuffer = []
  }

  private clearPreRoll(): void {
    this.preRollBuffer = []
  }

  processWorkletFrame(seq: number, samples: Float32Array): void {
    this.processFrame({
      seq,
      samples,
      sampleRate: 16000,
      timestamp: Date.now(),
      source: 'worklet'
    })
  }

  processTestFrame(samples: Float32Array): void {
    if (import.meta.env.MODE !== 'test' && import.meta.env.MODE !== 'development') {
      logger.warn('pcmPipeline.processTestFrame.ignored.not.test')
      return
    }
    this.processFrame({
      seq: this.currentSeq++,
      samples,
      sampleRate: 16000,
      timestamp: Date.now(),
      source: 'test-injection'
    })
  }

  private float32ToInt16(float32Data: Float32Array): Uint8Array {
    const int16Array = new Int16Array(float32Data.length)
    for (let i = 0; i < float32Data.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Data[i]))
      int16Array[i] = sample < 0 ? sample * 32768 : sample * 32767
    }

    const uint8Array = new Uint8Array(int16Array.length * 2)
    for (let i = 0; i < int16Array.length; i++) {
      uint8Array[i * 2] = int16Array[i] & 0xFF
      uint8Array[i * 2 + 1] = (int16Array[i] >> 8) & 0xFF
    }
    return uint8Array
  }

  getDiagnostics() {
    return { ...this.diagnostics }
  }

  reset(): void {
    this.currentSeq = 0
    this.diagnostics.injectFrames = 0
    this.diagnostics.pcmFramesProcessed = 0
    this.diagnostics.vadFramesProcessed = 0
    this.diagnostics.transportFramesSent = 0
    this.diagnostics.lastStage = 'idle'
    this.diagnostics.lastSource = 'worklet'
    this.diagnostics.lastVadState = 'IDLE'
    this.preRollBuffer = []
    this.prevVadState = 'IDLE'
  }
}

export const pcmPipeline = new PcmPipeline()
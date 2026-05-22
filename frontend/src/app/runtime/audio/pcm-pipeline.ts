import { getLogger } from '@livekit-voice/shared/logger'
import { speechDetector } from './speech-detector'
import { binaryTransport } from '../transport'

const logger = getLogger()

export interface PcmFrame {
  seq: number
  samples: Float32Array
  sampleRate: number
  timestamp: number
  source: 'worklet' | 'test-injection'
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
   * CANONICAL ENTRY POINT - All PCM sources flow through this method
   * @param frame - PcmFrame from any source (worklet, test, replay)
   */
  processFrame(frame: PcmFrame): void {
    const seq = frame.seq >= 0 ? frame.seq : this.currentSeq++

    this.diagnostics.injectFrames++
    this.diagnostics.pcmFramesProcessed++
    this.diagnostics.lastSource = frame.source
    this.diagnostics.lastStage = 'pcm'

    logger.debug('pipeline.pcm', {
      seq,
      samples: frame.samples.length,
      source: frame.source
    })

    const vadState = speechDetector.onFrame(frame.samples)
    this.diagnostics.lastVadState = vadState
    this.diagnostics.vadFramesProcessed++
    this.diagnostics.lastStage = 'vad'

    logger.debug('pipeline.vad', { state: vadState })

    let sum = 0
    for (let i = 0; i < frame.samples.length; i++) {
      sum += frame.samples[i] * frame.samples[i]
    }
    const rms = Math.sqrt(sum / frame.samples.length)
    const hasVoice = rms > 0.01

    const pcmData = this.float32ToInt16(frame.samples)
    binaryTransport.sendFrame({ seq, pcm: pcmData })
    this.diagnostics.transportFramesSent++
    this.diagnostics.lastStage = 'transport'

    logger.debug('pipeline.transport.send', { seq, pcmSize: pcmData.length })
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
  }
}

export const pcmPipeline = new PcmPipeline()
import { getLogger } from '@livekit-voice/shared/logger'
import { binaryTransport } from '../transport'
import { speechDetector } from './speech-detector'

const logger = getLogger()

export type AudioLevelCallback = (level: number) => void

export class AudioRecorder {
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private audioLevelCallback: AudioLevelCallback | null = null
  private _isRecording = false

  async start(): Promise<void> {
    logger.info('audio.recording.starting')

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      })

      logger.info('audio.recording.access.granted', { tracks: this.mediaStream.getTracks().length })

      this.audioContext = new AudioContext({ sampleRate: 16000 })

      logger.info('audio.worklet.loading', { url: new URL('./pcm-capture-processor.ts', import.meta.url).href })
      
      try {
        await this.audioContext.audioWorklet.addModule(
          new URL('./pcm-capture-processor.ts', import.meta.url).href
        )
        logger.info('audio.worklet.loaded')
      } catch (err) {
        logger.error('audio.worklet.load.failed', { err })
        throw err
      }

      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-capture-processor')
      logger.info('audio.worklet.node.created')

      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'pcm') {
          this.onPcmData(event.data.seq as number, event.data.data as Float32Array)
        }
      }

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      source.connect(this.workletNode)

      this._isRecording = true
      logger.info('audio.recording.started', { state: 'recording' })
    } catch (error) {
      logger.error('audio.recording.error', { error: String(error) })
      throw error
    }
  }

  private onPcmData(seq: number, float32Data: Float32Array): void {
    if (!this._isRecording) return

    // Feed to SpeechDetector for speech detection (VAD)
    speechDetector.onFrame(float32Data)

    // Compute RMS for UI
    let sum = 0
    for (let i = 0; i < float32Data.length; i++) {
      sum += float32Data[i] * float32Data[i]
    }
    const rms = Math.sqrt(sum / float32Data.length)
    const hasVoice = rms > 0.01

    logger.debug('audio.pcm', { 
      rms: rms.toFixed(4), 
      hasVoice, 
      samples: float32Data.length,
      isRecording: this._isRecording 
    })

    // Update UI volume indicator
    if (this.audioLevelCallback) {
      this.audioLevelCallback(hasVoice ? 50 : 0)
    }

    // Always send PCM - SpeechDetector manages turn lifecycle
    const pcmData = this.float32ToInt16Pcm(float32Data)
    binaryTransport.sendFrame({ seq, pcm: pcmData })
  }

  private float32ToInt16Pcm(float32Data: Float32Array): Uint8Array {
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

  async stop(): Promise<void> {
    logger.info('audio.recording.stop.requested')

    this._isRecording = false

    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode.port.onmessage = null
      this.workletNode = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        track.stop()
      })
      this.mediaStream = null
    }

    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

    this.audioLevelCallback = null
    logger.info('audio.recording.stopped')
  }

  async flush(): Promise<void> {
    // Wait for pending worklet frames to be delivered (~50ms)
    await new Promise(resolve => setTimeout(resolve, 50))
    logger.debug('audio.recording.flush.done')
  }

  resetWorkletSeq(): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'reset' })
      logger.debug('audio.worklet.seq.reset')
    }
  }

  setAudioLevelCallback(callback: AudioLevelCallback): void {
    this.audioLevelCallback = callback
  }

  isRecording(): boolean {
    return this._isRecording
  }
}

export const audioRecorder = new AudioRecorder()
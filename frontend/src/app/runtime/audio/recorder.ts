import { getLogger } from '@livekit-voice/shared/logger'
import { diagnosticsCollector } from '../debug-provider'
import { pcmPipeline } from './pcm-pipeline'
import { speechDetector } from './speech-detector'

const logger = getLogger()

/**
 * AudioWorklet processor code inlined as string.
 * Loaded via Blob URL to avoid file-path issues in Electron (file:// protocol).
 */
const PCM_CAPTURE_WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.currentSeq = 0
    this.port.onmessage = (event) => {
      if (event.data.type === 'reset') {
        this.currentSeq = 0
      }
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (!input || !input[0]) return true
    const channelData = input[0]
    this.port.postMessage({
      type: 'pcm',
      seq: this.currentSeq++,
      data: channelData
    })
    return true
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
`

export type AudioLevelCallback = (level: number) => void

export class AudioRecorder {
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private audioLevelCallback: AudioLevelCallback | null = null
  private _isRecording = false
  private _testMode = false

  setTestMode(enabled: boolean): void {
    this._testMode = enabled
    logger.debug('audio.recorder.testMode', { enabled })
  }

  async start(): Promise<void> {
    if (this._testMode) {
      logger.info('audio.recording.starting.testMode')
      this._isRecording = true
      diagnosticsCollector.add({
        source: 'audio.recorder',
        type: 'recording.started.testMode'
      })
      diagnosticsCollector.updateState({ audio: { recording: true } })
      speechDetector.reset()
      pcmPipeline.reset()
      logger.info('audio.recording.started.testMode')
      return
    }

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

      logger.info('audio.worklet.loading')
      
      try {
        const blob = new Blob([PCM_CAPTURE_WORKLET_CODE], { type: 'application/javascript' })
        const blobUrl = URL.createObjectURL(blob)
        await this.audioContext.audioWorklet.addModule(blobUrl)
        logger.info('audio.worklet.loaded')
      } catch (err) {
        logger.error('audio.worklet.load.failed', { err })
        throw err
      }

      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-capture-processor')
      logger.info('audio.worklet.node.created')

      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'pcm') {
          pcmPipeline.processWorkletFrame(
            event.data.seq as number,
            event.data.data as Float32Array
          )
        }
      }

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      source.connect(this.workletNode)

      this._isRecording = true
      diagnosticsCollector.add({
        source: 'audio.recorder',
        type: 'recording.started'
      })
      diagnosticsCollector.updateState({ audio: { recording: true } })
      speechDetector.reset()
      pcmPipeline.reset()
      logger.info('audio.recording.started', { state: 'recording' })
    } catch (error) {
      logger.error('audio.recording.error', { error: String(error) })
      throw error
    }
  }

  async stop(): Promise<void> {
    logger.info('audio.recording.stop.requested')

    this._isRecording = false
    diagnosticsCollector.add({
      source: 'audio.recorder',
      type: 'recording.stopped'
    })
    diagnosticsCollector.updateState({ audio: { recording: false } })

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

  injectPcmData(float32Data: Float32Array): void {
    if (!this._isRecording) {
      logger.warn('audio.inject.ignored.not.recording')
      return
    }
    if (!this._testMode) {
      logger.warn('audio.inject.ignored.not.testMode')
      return
    }
    logger.debug('audio.inject.pcm', { samples: float32Data.length })
    pcmPipeline.processTestFrame(float32Data)
  }
}

export const audioRecorder = new AudioRecorder()

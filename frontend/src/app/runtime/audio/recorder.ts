import { getLogger } from '../../shared/logger'

const logger = getLogger()

export type AudioLevelCallback = (level: number) => void

export class AudioRecorder {
  private mediaStream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private animationFrame: number | null = null
  private audioLevelCallback: AudioLevelCallback | null = null

  async start(): Promise<void> {
    logger.info('audio.recording.starting')

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      logger.info('audio.recording.access.granted', { tracks: this.mediaStream.getTracks().length })

      this.audioContext = new AudioContext()
      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      source.connect(this.analyser)

      const options = this.getSupportedMimeType()
      logger.info('audio.recording.mimeType.selected', { mimeType: options.mimeType })

      this.mediaRecorder = new MediaRecorder(this.mediaStream, options)

      this.mediaRecorder.ondataavailable = (event) => {
        logger.debug('audio.recording.data.available', { size: event.data.size })
      }

      this.mediaRecorder.onstart = () => {
        logger.info('audio.recording.started', { state: this.mediaRecorder?.state })
        this.startAudioLevelMonitoring()
      }

      this.mediaRecorder.onstop = () => {
        logger.info('audio.recording.stopped', { state: this.mediaRecorder?.state })
        this.stopAudioLevelMonitoring()
      }

      this.mediaRecorder.start(100)
      logger.info('audio.recording.ready', { state: this.mediaRecorder?.state })
    } catch (error) {
      logger.error('audio.recording.error', { error: String(error) })
      throw error
    }
  }

  private getSupportedMimeType(): { mimeType: string } {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        logger.debug('audio.recording.mimeType.supported', { mimeType: type })
        return { mimeType: type }
      }
    }

    logger.warn('audio.recording.mimeType.none.supported')
    return { mimeType: '' }
  }

  private startAudioLevelMonitoring(): void {
    if (!this.analyser) return

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    const updateLevel = () => {
      if (!this.analyser || !this.audioLevelCallback) return

      this.analyser.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      const level = Math.min(100, Math.round(average * 1.5))

      this.audioLevelCallback(level)
      this.animationFrame = requestAnimationFrame(updateLevel)
    }

    updateLevel()
  }

  private stopAudioLevelMonitoring(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
    this.audioLevelCallback = null
  }

  setAudioLevelCallback(callback: AudioLevelCallback): void {
    this.audioLevelCallback = callback
  }

  onDataAvailable(callback: (data: Blob) => void): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = (event) => {
        logger.debug('audio.recording.data', { size: event.data.size })
        callback(event.data)
      }
    }
  }

  async stop(): Promise<void> {
    logger.info('audio.recording.stop.requested', { state: this.mediaRecorder?.state })

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        logger.debug('audio.recording.track.stopping', { kind: track.kind, enabled: track.enabled })
        track.stop()
      })
      this.mediaStream = null
    }

    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

    this.stopAudioLevelMonitoring()
    logger.info('audio.recording.stopped')
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }
}

export const audioRecorder = new AudioRecorder()
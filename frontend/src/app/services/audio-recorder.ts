export type AudioLevelCallback = (level: number) => void

class AudioRecorder {
  private mediaStream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private animationFrame: number | null = null
  private audioLevelCallback: AudioLevelCallback | null = null

  async start(): Promise<void> {
    console.log('[AudioRecorder] Requesting microphone access...')
    
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    console.log('[AudioRecorder] Microphone access granted, tracks:', this.mediaStream.getTracks().length)

    this.audioContext = new AudioContext()
    const source = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 256
    source.connect(this.analyser)

    const options = this.getSupportedMimeType()
    console.log('[AudioRecorder] Using mimeType:', options.mimeType)

    this.mediaRecorder = new MediaRecorder(this.mediaStream, options)
    
    this.mediaRecorder.ondataavailable = (event) => {
      console.log('[AudioRecorder] Data available, size:', event.data.size)
    }
    
    this.mediaRecorder.onstart = () => {
      console.log('[AudioRecorder] MediaRecorder started, state:', this.mediaRecorder?.state)
      this.startAudioLevelMonitoring()
    }
    
    this.mediaRecorder.onstop = () => {
      console.log('[AudioRecorder] MediaRecorder stopped, state:', this.mediaRecorder?.state)
      this.stopAudioLevelMonitoring()
    }

    this.mediaRecorder.start(100)
    console.log('[AudioRecorder] Started recording, state:', this.mediaRecorder?.state)
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
        console.log('[AudioRecorder] Supported mimeType:', type)
        return { mimeType: type }
      }
    }
    
    console.log('[AudioRecorder] No supported mimeType found, using default')
    return { mimeType: '' }
  }

  private startAudioLevelMonitoring(): void {
    if (!this.analyser) return

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    const updateLevel = () => {
      if (!this.analyser || !this.audioLevelCallback) return

      this.analyser.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length
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

  stop(): void {
    console.log('[AudioRecorder] Stop called, current state:', this.mediaRecorder?.state)
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        console.log('[AudioRecorder] Stopping track:', track.kind, track.enabled)
        track.stop()
      })
      this.mediaStream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.stopAudioLevelMonitoring()

    console.log('[AudioRecorder] Stopped recording')
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }
}

export const audioRecorder = new AudioRecorder()
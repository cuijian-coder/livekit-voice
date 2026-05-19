declare const AudioWorkletProcessor: any
declare const registerProcessor: any

class PcmCaptureProcessor extends AudioWorkletProcessor {
  private currentSeq = 0

  constructor() {
    super()
    this.port.onmessage = (event: any) => {
      if (event.data.type === 'reset') {
        this.currentSeq = 0
      }
    }
  }

  process(inputs: any, outputs: any, parameters: any): boolean {
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
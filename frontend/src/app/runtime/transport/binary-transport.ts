import { wsClient } from './websocket-client'
import { getLogger } from '@livekit-voice/shared/logger'
import { invariant, assertNotNull } from '../../../../../self-healing/assert'

const logger = getLogger()

export class BinaryTransport {
  private isActive = false
  private currentTurnId = ''
  private lastSeq = -1

  startTurn(turnId: string): void {
    this.isActive = true
    this.currentTurnId = turnId
    this.lastSeq = -1
    logger.debug('binaryTransport.start', { turnId })
  }

  sendFrame(frame: { seq: number, pcm: Uint8Array }): void {
    invariant(this.isActive, 'binaryTransport must be active before sendFrame')
    invariant(this.currentTurnId !== '', 'turnId must be set before sendFrame')
    assertNotNull(frame.pcm, 'frame.pcm must not be null')
    invariant(frame.pcm.length > 0, 'frame.pcm must be non-empty')

    if (!this.isActive) {
      logger.warn('binaryTransport.send.ignored.not.active')
      return
    }

    this.lastSeq = frame.seq

    // Build binary frame: [seq: uint32 LE][PCM: Int16[]]
    const seqBuffer = new ArrayBuffer(4)
    const seqView = new DataView(seqBuffer)
    seqView.setUint32(0, frame.seq, true)  // little-endian

    const seqArray = new Uint8Array(seqBuffer)
    const frameData = this.concatArrays(seqArray, frame.pcm)

    wsClient.sendBinary(frameData)
    logger.debug('binaryTransport.sent', { seq: frame.seq, pcmSize: frame.pcm.length })
  }

  async flush(): Promise<void> {
    // Wait for websocket bufferedAmount to be 0
    let attempts = 0
    const maxAttempts = 100

    while (attempts < maxAttempts) {
      // Get the underlying ws to check bufferedAmount
      const bufferedAmount = (wsClient as any).ws?.bufferedAmount
      if (bufferedAmount === 0 || bufferedAmount === undefined) {
        logger.debug('binaryTransport.flush.done', { attempts })
        return
      }
      await new Promise(resolve => setTimeout(resolve, 10))
      attempts++
    }

    logger.warn('binaryTransport.flush.timeout', { attempts })
  }

  async commit(): Promise<void> {
    invariant(this.isActive, 'binaryTransport must be active before commit')
    invariant(this.currentTurnId !== '', 'turnId required before commit')
    invariant(this.lastSeq >= 0, 'at least one frame must be sent before commit')

    if (!this.isActive || !this.currentTurnId) {
      logger.warn('binaryTransport.commit.ignored')
      return
    }

    const finalSeq = this.lastSeq
    logger.info('binaryTransport.committing', { turnId: this.currentTurnId, finalSeq })

    wsClient.send({
      type: 'audio.commit',
      turnId: this.currentTurnId,
      finalSeq
    } as any)

    logger.info('binaryTransport.commit.sent')
    this.reset()
  }

  cancel(): void {
    if (this.isActive) {
      logger.info('binaryTransport.cancelled', { turnId: this.currentTurnId })
      this.reset()
    }
  }

  private concatArrays(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result = new Uint8Array(a.length + b.length)
    result.set(a, 0)
    result.set(b, a.length)
    return result
  }

  private reset(): void {
    this.isActive = false
    this.currentTurnId = ''
    this.lastSeq = -1
  }
}

export const binaryTransport = new BinaryTransport()
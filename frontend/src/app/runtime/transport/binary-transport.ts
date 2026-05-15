import { wsClient } from './websocket-client'
import { CLIENT_EVENTS } from './protocol'
import { getLogger } from '@livekit-voice/shared/logger'

const logger = getLogger()

export interface BinaryTransportConfig {
  maxChunkSize: number
  enableCompression: boolean
}

export class BinaryTransport {
  private audioChunks: Uint8Array[] = []
  private isActive = false
  private currentTurnId: string | null = null

  startChunking(turnId: string): void {
    this.audioChunks = []
    this.isActive = true
    this.currentTurnId = turnId
    logger.debug('binaryTransport.start', { turnId })
  }

  appendChunk(chunk: Uint8Array): void {
    if (!this.isActive) {
      logger.warn('binaryTransport.append.ignored.not.active')
      return
    }

    this.audioChunks.push(chunk)
    logger.debug('binaryTransport.chunk.appended', { chunkSize: chunk.length, totalChunks: this.audioChunks.length })
  }

  async commit(): Promise<void> {
    if (!this.isActive || !this.currentTurnId) {
      logger.warn('binaryTransport.commit.ignored')
      return
    }

    if (this.audioChunks.length === 0) {
      logger.warn('binaryTransport.commit.no.chunks')
      this.reset()
      return
    }

    const combined = this.combineChunks()
    logger.info('binaryTransport.committing', { totalSize: combined.length, chunks: this.audioChunks.length })

    try {
      await this.sendAudioData(combined)
      wsClient.send({ type: CLIENT_EVENTS.AUDIO_COMMIT })
      logger.info('binaryTransport.commit.success')
    } catch (err) {
      logger.error('binaryTransport.commit.error', { err })
    } finally {
      this.reset()
    }
  }

  cancel(): void {
    if (this.isActive) {
      logger.info('binaryTransport.cancelled', { turnId: this.currentTurnId })
      this.reset()
    }
  }

  private combineChunks(): Uint8Array {
    const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of this.audioChunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  }

  private async sendAudioData(data: Uint8Array): Promise<void> {
    const CHUNK_SIZE = 16384

    if (data.length <= CHUNK_SIZE) {
      wsClient.sendBinary(data)
      return
    }

    let offset = 0
    while (offset < data.length) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE)
      wsClient.sendBinary(chunk)
      offset += chunk.length

      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    logger.debug('binaryTransport.sent.multi.chunk', { totalChunks: Math.ceil(data.length / CHUNK_SIZE) })
  }

  private reset(): void {
    this.audioChunks = []
    this.isActive = false
    this.currentTurnId = null
  }
}

export const binaryTransport = new BinaryTransport()
import { WebSocket, WebSocketServer } from 'ws'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export type MockWsEvent =
  | { type: 'asr.partial'; text: string; turnId: string; seq: number }
  | { type: 'asr.final'; text: string; turnId: string }
  | { type: 'llm.token'; token: string }
  | { type: 'llm.complete'; fullText: string }
  | { type: 'llm.started' }
  | { type: 'tts.started' }
  | { type: 'tts.chunk'; size: number }
  | { type: 'tts.complete' }
  | { type: 'readAloud.started'; messageId: string }
  | { type: 'readAloud.complete'; messageId: string }
  | { type: 'state.update'; state: string; turnId: string }
  | { type: 'session.started'; sessionId: string; state: string }
  | { type: 'playback.completed'; turnId: string; interrupted: boolean }

export interface MockWsConfig {
  port?: number
  autoRespond?: boolean
  responseDelay?: number
}

export class MockWsServer {
  private wss: WebSocketServer | null = null
  private clients: Set<WebSocket> = new Set()
  private eventQueue: MockWsEvent[] = []
  private autoRespond = true
  private responseDelay = 100

  constructor(config: MockWsConfig = {}) {
    this.autoRespond = config.autoRespond ?? true
    this.responseDelay = config.responseDelay ?? 100
  }

  async start(port = 3001): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port })

        this.wss.on('connection', (ws) => {
          this.clients.add(ws)
          console.log('[MockWs] Client connected')

          if (this.autoRespond) {
            this.scheduleAutoResponse()
          }

          ws.on('message', (data) => {
            try {
              const msg = JSON.parse(data.toString())
              this.handleMessage(ws, msg)
            } catch {
              // Ignore non-JSON messages (e.g., binary audio frames)
            }
          })

          ws.on('close', () => {
            this.clients.delete(ws)
            console.log('[MockWs] Client disconnected')
          })

          resolve()
        })

        this.wss.on('error', reject)
      } catch (err) {
        reject(err)
      }
    })
  }

  private scheduleAutoResponse(): void {
    setTimeout(() => {
      this.broadcast({ type: 'session.started', sessionId: 'mock-session', state: 'idle' })
    }, this.responseDelay)
  }

  private handleMessage(ws: WebSocket, msg: any): void {
    switch (msg.type) {
      case 'session.start':
        this.broadcast({ type: 'session.started', sessionId: 'mock-session', state: 'idle' })
        break

      case 'audio.start':
        this.broadcast({ type: 'state.update', state: 'listening', turnId: msg.turnId })
        break

      case 'audio.commit':
        this.broadcast({ type: 'asr.final', text: 'Test transcript', turnId: msg.turnId })
        setTimeout(() => {
          this.broadcast({ type: 'llm.started' })
          this.broadcast({ type: 'llm.token', token: 'Hello' })
          setTimeout(() => {
            this.broadcast({ type: 'llm.complete', fullText: 'Hello, how can I help you?' })
            // Simulate TTS completion to return to idle
            setTimeout(() => {
              this.broadcast({ type: 'tts.complete' })
              this.broadcast({ type: 'state.update', state: 'idle', turnId: '' })
            }, 500)
          }, 100)
        }, 100)
        break

      case 'submit.text':
        // Text submission does not send asr.final (no speech recognition needed)
        setTimeout(() => {
          this.broadcast({ type: 'llm.started' })
          this.broadcast({ type: 'llm.token', token: 'Response' })
          setTimeout(() => {
            this.broadcast({ type: 'llm.complete', fullText: 'This is a mock response.' })
            // Simulate TTS completion to return to idle
            setTimeout(() => {
              this.broadcast({ type: 'tts.complete' })
              this.broadcast({ type: 'state.update', state: 'idle', turnId: '' })
            }, 500)
          }, 100)
        }, 100)
        break

      case 'interrupt':
        this.broadcast({ type: 'state.update', state: 'idle', turnId: '' })
        this.broadcast({ type: 'playback.completed', turnId: 'mock-turn', interrupted: true })
        break

      case 'readAloud.start':
        this.handleReadAloudStart(ws, msg.messageId, msg.text)
        break

      case 'ping':
        this.broadcast({ type: 'pong' })
        break

      default:
        console.log('[MockWs] Unhandled message type:', msg.type)
    }
  }

  private async handleReadAloudStart(ws: WebSocket, messageId: string, text: string): Promise<void> {
    console.log('[MockWs] Read Aloud start:', messageId, text.slice(0, 50))
    
    // Send started event
    this.broadcast({ type: 'readAloud.started', messageId })
    
    try {
      // Read wav file and send as binary chunks
      const wavPath = resolve(process.cwd(), 'self-healing/e2e/fixtures/audio/nls-sample-16k.wav')
      const wavBuffer = readFileSync(wavPath)
      
      // Extract PCM data from WAV (skip header)
      // WAV header is typically 44 bytes
      const pcmData = wavBuffer.slice(44)
      const chunkSize = 2048
      
      // Send chunks with small delay
      for (let offset = 0; offset < pcmData.length; offset += chunkSize) {
        const chunk = pcmData.slice(offset, Math.min(offset + chunkSize, pcmData.length))
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunk, { binary: true })
        }
        // Small delay between chunks
        await new Promise(r => setTimeout(r, 50))
      }
      
      // Send complete event
      this.broadcast({ type: 'readAloud.complete', messageId })
      console.log('[MockWs] Read Aloud complete:', messageId)
    } catch (err) {
      console.error('[MockWs] Read Aloud error:', err)
      this.broadcast({ type: 'runtime.error', error: 'Read Aloud failed', code: 4004 } as any)
    }
  }

  broadcast(event: MockWsEvent): void {
    const message = JSON.stringify(event)
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }

  queueEvent(event: MockWsEvent): void {
    this.eventQueue.push(event)
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.clients.forEach((client) => client.close())
      this.wss?.close(() => resolve())
    })
  }

  get clientCount(): number {
    return this.clients.size
  }
}

let mockServer: MockWsServer | null = null

export async function startMockWsServer(config?: MockWsConfig): Promise<MockWsServer> {
  if (mockServer) {
    await mockServer.stop()
  }
  mockServer = new MockWsServer(config)
  await mockServer.start(config?.port ?? 3001)
  console.log('[MockWs] Server started on port', config?.port ?? 3001)
  return mockServer
}

export async function stopMockWsServer(): Promise<void> {
  if (mockServer) {
    await mockServer.stop()
    mockServer = null
    console.log('[MockWs] Server stopped')
  }
}

export function getMockWsServer(): MockWsServer | null {
  return mockServer
}
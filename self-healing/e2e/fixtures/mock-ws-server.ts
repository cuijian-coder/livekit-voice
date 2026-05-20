import { WebSocket, WebSocketServer } from 'ws'

export type MockWsEvent =
  | { type: 'asr.partial'; text: string; turnId: string; seq: number }
  | { type: 'asr.final'; text: string; turnId: string }
  | { type: 'llm.token'; token: string }
  | { type: 'llm.complete'; fullText: string }
  | { type: 'llm.started' }
  | { type: 'tts.started' }
  | { type: 'tts.chunk'; size: number }
  | { type: 'tts.complete' }
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
              console.log('[MockWs] Received:', msg.type)
              this.handleMessage(ws, msg)
            } catch {
              console.error('[MockWs] Failed to parse message')
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
          }, 100)
        }, 100)
        break

      case 'submit.text':
        this.broadcast({ type: 'asr.final', text: msg.text, turnId: 'mock-turn' })
        setTimeout(() => {
          this.broadcast({ type: 'llm.started' })
          this.broadcast({ type: 'llm.token', token: 'Response' })
          setTimeout(() => {
            this.broadcast({ type: 'llm.complete', fullText: 'This is a mock response.' })
          }, 100)
        }, 100)
        break

      case 'interrupt':
        this.broadcast({ type: 'state.update', state: 'idle', turnId: '' })
        this.broadcast({ type: 'playback.completed', turnId: 'mock-turn', interrupted: true })
        break

      case 'ping':
        this.broadcast({ type: 'pong' })
        break

      default:
        console.log('[MockWs] Unhandled message type:', msg.type)
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
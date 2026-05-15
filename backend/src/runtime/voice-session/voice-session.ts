import type { WebSocket } from 'ws'
import { createActor } from 'xstate'
import type { Logger } from 'pino'
import { CONVERSATION_STATES } from '@livekit-voice/shared/constants'
import { CLIENT_EVENTS, SERVER_EVENTS } from '@livekit-voice/shared/protocol'
import type { ConversationState } from '@livekit-voice/shared/constants'
import { conversationMachine } from '../state-machine/conversation-machine.js'
import { PlaybackQueue } from '../playback/playback-queue.js'
import { DiagnosticsCollector } from '../diagnostics/diagnostics-collector.js'
import { SessionEventBus } from '@livekit-voice/shared'
import { nanoid } from 'nanoid'
import { QwenAsrWorker } from '../../workers/asr/qwen-asr.worker.js'
import { QwenLlmWorker } from '../../workers/llm/qwen-llm.worker.js'
import { QwenTtsWorker } from '../../workers/tts/qwen-tts.worker.js'

const s = CONVERSATION_STATES

export class VoiceSession {
  readonly sessionId: string
  readonly createdAt: number

  private ws: WebSocket
  private logger: Logger
  private eventBus: SessionEventBus
  private playbackQueue: PlaybackQueue
  private diagnostics: DiagnosticsCollector
  private actor: ReturnType<typeof createActor<typeof conversationMachine>>
  private audioBuffer: Buffer[] = []
  private currentTurnId = ''
  private _state: ConversationState = CONVERSATION_STATES.IDLE
  private abortController = new AbortController()

  private asrWorker = new QwenAsrWorker()
  private llmWorker = new QwenLlmWorker()
  private ttsWorker = new QwenTtsWorker()
  private currentTranscript = ''

  constructor(ws: WebSocket, logger: Logger) {
    this.sessionId = nanoid(12)
    this.createdAt = Date.now()
    this.ws = ws
    this.logger = logger
    this.eventBus = new SessionEventBus()
    this.playbackQueue = new PlaybackQueue()
    this.diagnostics = new DiagnosticsCollector()

    const ctx = {
      sessionId: this.sessionId,
      turnId: '',
      transcript: '',
      partialTranscript: '',
      responseBuffer: '',
      diagnostics: this.diagnostics,
      abortControllers: new Map<string, AbortController>(),
      playbackQueue: this.playbackQueue,
    }

    this.actor = createActor(conversationMachine as any, { input: ctx })
    this.actor.start()

    this.actor.subscribe((snapshot: any) => {
      const newState = snapshot.value as ConversationState
      if (newState !== this._state) {
        this.diagnostics.recordTransition(this._state, newState)
        this._state = newState
        this.logger.debug({ sessionId: this.sessionId, from: this._state, to: newState }, 'state.transition')
        this.onStateChange(newState)
      }
    })

    this.logger.info({ sessionId: this.sessionId }, 'session.created')
  }

  private onStateChange(state: ConversationState): void {
    if (state === s.THINKING) {
      this.runLlm().catch((err) => this.handleError('llm', err))
    }
  }

  private async runLlm(): Promise<void> {
    const signal = this.abortController.signal
    if (signal.aborted) return

    this.logger.info({ sessionId: this.sessionId }, 'llm.started')
    this.send({ type: SERVER_EVENTS.LLM_STARTED })

    try {
      let fullResponse = ''
      for await (const token of this.llmWorker.stream(this.currentTranscript || '你好', signal)) {
        if (signal.aborted) return
        fullResponse += token
        this.send({ type: SERVER_EVENTS.LLM_TOKEN, token })
        this.diagnostics.recordLlmToken(token)
      }

      if (signal.aborted) return
      this.logger.info({ sessionId: this.sessionId, responseLength: fullResponse.length }, 'llm.complete')
      this.actor.send({ type: 'LLM_COMPLETE' })
      await this.runTts(fullResponse)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      this.handleError('llm', err as Error)
    }
  }

  private async runTts(text: string): Promise<void> {
    const signal = this.abortController.signal
    if (signal.aborted) return

    this.logger.info({ sessionId: this.sessionId, textLength: text.length }, 'tts.started')
    this.send({ type: SERVER_EVENTS.TTS_STARTED })

    try {
      for await (const audioChunk of this.ttsWorker.stream(text, signal)) {
        if (signal.aborted) return
        if (audioChunk.length === 0) continue
        this.sendBinary(audioChunk)
        this.diagnostics.recordTtsChunk(audioChunk.length)
      }

      if (signal.aborted) return
      this.logger.info({ sessionId: this.sessionId }, 'tts.complete')
      this.actor.send({ type: 'SPEAK_COMPLETE' })
      this.sendPlaybackCompleted(false)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      this.handleError('tts', err as Error)
    }
  }

  get state(): ConversationState {
    return this._state
  }

  get turnId(): string {
    return this.currentTurnId
  }

  getEventBus(): SessionEventBus {
    return this.eventBus
  }

  handleMessage(msg: any): void {
    switch (msg.type) {
      case CLIENT_EVENTS.SESSION_START:
        this.handleSessionInit()
        break
      case 'audio':
        this.handleAudio(msg.data, msg.turnId)
        break
      case 'vad.end':
        this.handleVadEnd()
        break
      case 'interrupt':
        this.handleInterrupt()
        break
      case 'ping':
        this.sendPong()
        break
      case 'getDiagnostics':
        this.sendDiagnostics()
        break
      default:
        this.logger.warn({ sessionId: this.sessionId, type: msg.type }, 'unknown.message.type')
    }
  }

  handleBinaryFrame(data: Buffer, turnId: string): void {
    this.eventBus.emit('audio.chunk.received', data)
    this.audioBuffer.push(data)
    this.currentTurnId = turnId
    this.logger.debug({ sessionId: this.sessionId, turnId, size: data.length }, 'audio.chunk.received')
  }

  private handleSessionInit(): void {
    this.sendStateUpdate()
    this.logger.info({ sessionId: this.sessionId }, 'session.established')
  }

  private handleAudio(data: string, turnId: string): void {
    const chunk = Buffer.from(data, 'base64')
    this.handleBinaryFrame(chunk, turnId)
  }

  private handleVadEnd(): void {
    if (this._state !== CONVERSATION_STATES.LISTENING) {
      this.logger.warn({ sessionId: this.sessionId, state: this._state }, 'vad.end.invalid.state')
      return
    }
    this.actor.send({ type: 'VAD_END' })
    this.eventBus.emit('vad.ended')
    this.startTranscribing()
  }

  private async startTranscribing(): Promise<void> {
    if (this.audioBuffer.length === 0) {
      this.logger.warn({ sessionId: this.sessionId }, 'no.audio.to.transcribe')
      this.actor.send({ type: 'ASR_COMPLETE', text: '' })
      return
    }

    const signal = this.abortController.signal
    const audioData = Buffer.concat(this.audioBuffer)
    this.audioBuffer = []

    this.logger.info({ sessionId: this.sessionId, audioBytes: audioData.length }, 'asr.started')

    try {
      const audioStream = (async function* (): AsyncIterable<Buffer> {
        yield audioData
      })()

      let finalText = ''
      for await (const result of this.asrWorker.stream(audioStream, signal)) {
        if (signal.aborted) return
        if (!result.isFinal) {
          this.send({ type: SERVER_EVENTS.ASR_PARTIAL, text: result.text })
        } else {
          finalText = result.text
          this.send({ type: SERVER_EVENTS.ASR_FINAL, text: finalText })
        }
      }

      if (signal.aborted) return
      this.actor.send({ type: 'ASR_COMPLETE', text: finalText })
      this.currentTranscript = finalText
      this.logger.info({ sessionId: this.sessionId, text: finalText }, 'asr.complete')
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      this.handleError('asr', err as Error)
      this.actor.send({ type: 'ERROR', error: (err as Error).message })
    }
  }

  private handleInterrupt(): void {
    this.logger.info({ sessionId: this.sessionId, turnId: this.currentTurnId }, 'interrupt.received')
    this.abortController.abort()
    this.abortController = new AbortController()
    this.playbackQueue.clear()
    this.audioBuffer = []
    this.diagnostics.recordInterrupt(this.currentTurnId, 'user')
    this.actor.send({ type: 'INTERRUPT' })
    this.eventBus.emit('interrupt.detected', 'user')
    this.sendPlaybackCompleted(true)
  }

  private sendPong(): void {
    this.send({ type: 'pong' })
  }

  private sendDiagnostics(): void {
    this.send({ type: 'diagnostics', metrics: this.diagnostics.getSnapshot() })
  }

  private sendStateUpdate(): void {
    this.send({ type: 'state.update', state: this._state, turnId: this.currentTurnId })
  }

  handleError(worker: 'asr' | 'llm' | 'tts', error: Error): void {
    this.diagnostics.recordStreamError(worker, error.message)
    this.logger.error({ sessionId: this.sessionId, worker, error: error.message }, 'stream.error')
    this.playbackQueue.clear()
    this.actor.send({ type: 'ERROR', error: error.message })
    this.send({ type: 'runtime.error', error: error.message, code: 4003 })
  }

  async recover(): Promise<void> {
    this.logger.info({ sessionId: this.sessionId }, 'session.recovering')
    this.abortController.abort()
    this.abortController = new AbortController()
    this.actor.send({ type: 'RECOVER' })
    this._state = CONVERSATION_STATES.IDLE
    this.audioBuffer = []
    this.diagnostics.resetLatency()
  }

  send(msg: any): void {
    if (this.ws.readyState !== this.ws.OPEN) return
    try {
      this.ws.send(JSON.stringify(msg))
    } catch (err) {
      this.logger.error({ sessionId: this.sessionId, err }, 'send.failed')
    }
  }

  sendBinary(data: Buffer): void {
    if (this.ws.readyState !== this.ws.OPEN) return
    try {
      this.ws.send(data, { binary: true })
    } catch (err) {
      this.logger.error({ sessionId: this.sessionId, err }, 'sendBinary.failed')
    }
  }

  private sendPlaybackCompleted(interrupted = false): void {
    this.send({ type: 'playback.completed', turnId: this.currentTurnId, interrupted })
  }

  destroy(): void {
    this.logger.info({ sessionId: this.sessionId }, 'session.destroyed')
    this.actor.stop()
    this.eventBus.removeAllListeners()
    this.playbackQueue.clear()
    this.audioBuffer = []
    this.abortController.abort()
  }
}
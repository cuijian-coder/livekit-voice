import type { WebSocket } from 'ws'
import { createActor } from 'xstate'
import type { Logger } from 'pino'
import { CONVERSATION_STATES } from '@livekit-voice/shared/constants'
import { CLIENT_EVENTS, SERVER_EVENTS } from '@livekit-voice/shared/protocol'
import type { ConversationState } from '@livekit-voice/shared/constants'
import { conversationMachine } from '../state-machine/conversation-machine.js'
import { PlaybackQueue } from '../playback/playback-queue.js'
import type { BackendDiagnosticsCollector } from '../diagnostics-collector.js'
import { SessionEventBus } from '@livekit-voice/shared'
import { nanoid } from 'nanoid'
import { QwenAsrWorker, MockAsrWorker } from '../../workers/asr/qwen-asr.worker.js'
import { QwenLlmWorker, MockLlmWorker } from '../../workers/llm/qwen-llm.worker.js'
import { NlsGatewayTtsWorker } from '../../workers/tts/nls-gateway-tts.worker.js'
import { AliyunStreamingTtsWorker } from '../../workers/tts/aliyun-streaming-tts.worker.js'
import { getConfig } from '../../infra/config/config.js'
import { invariant, assertNotNull } from '../../../../self-healing/assert.js'

const s = CONVERSATION_STATES

export class VoiceSession {
  readonly sessionId: string
  readonly createdAt: number

  private ws: WebSocket
  private logger: Logger
  private eventBus: SessionEventBus
  private playbackQueue: PlaybackQueue
  private diagnostics: BackendDiagnosticsCollector
  private actor: ReturnType<typeof createActor<typeof conversationMachine>>
  private audioBuffer: Buffer[] = []
  private frameBuffer: Map<number, Buffer> = new Map()
  private currentTurnId = ''
  private currentSeq = 0
  private _state: ConversationState = CONVERSATION_STATES.IDLE
  private abortController = new AbortController()

  private asrWorker = (() => {
    const cfg = getConfig()
    if (cfg.QWEN_API_KEY === 'test') {
      return new MockAsrWorker()
    }
    return new QwenAsrWorker()
  })()
  private llmWorker = (() => {
    const cfg = getConfig()
    if (cfg.QWEN_API_KEY === 'test') {
      return new MockLlmWorker()
    }
    return new QwenLlmWorker()
  })()
  private asrFrameQueue: Buffer[] = []
  private asrStreamController: AbortController | null = null
  private asrStreamTask: Promise<void> | null = null
  private ttsWorker = (() => {
    const cfg = getConfig()
    if (cfg.TTS_MODE === 'websocket') {
      return new AliyunStreamingTtsWorker()
    }
    return new NlsGatewayTtsWorker()
  })()
  private currentTranscript = ''

  constructor(ws: WebSocket, logger: Logger, diagnostics: BackendDiagnosticsCollector) {
    this.sessionId = nanoid(12)
    this.createdAt = Date.now()
    this.ws = ws
    this.logger = logger.child({ sessionId: this.sessionId })
    this.eventBus = new SessionEventBus()
    this.playbackQueue = new PlaybackQueue()
    this.diagnostics = diagnostics

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
      this.logger.debug({ sessionId: this.sessionId, newState, oldState: this._state }, 'actor.subscribe callback')
      if (newState !== this._state) {
        const fromState = this._state
        this.diagnostics.add({
          source: 'conversation.machine',
          type: 'state.entered',
          turnId: this.currentTurnId || undefined,
          metadata: { state: newState, from: fromState }
        })
        this._state = newState
        this.logger.debug({ sessionId: this.sessionId, from: fromState, to: newState }, 'state.transition')
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
    try {
      if (!this.currentTurnId) {
        this.currentTurnId = `llm-turn-${Date.now()}`
      }
      const signal = this.abortController.signal
      if (signal.aborted) {
        this.logger.warn({ sessionId: this.sessionId }, 'llm.start.aborted')
        return
      }

this.logger.info({ sessionId: this.sessionId, transcript: this.currentTranscript }, 'llm.started')
    this.logger.info({ sessionId: this.sessionId, wsReadyState: this.ws.readyState }, 'ws_state_before_llm_start')
    this.send({ type: SERVER_EVENTS.LLM_STARTED })

      this.diagnostics.add({
        source: 'llm',
        type: 'stream.started',
        turnId: this.currentTurnId || undefined
      })

      const llmStartTime = Date.now()
      let tokenCount = 0

      let fullResponse = ''
      for await (const token of this.llmWorker.stream(this.currentTranscript || '你好', signal, this.logger)) {
        if (signal.aborted) {
          this.logger.info({ sessionId: this.sessionId }, 'llm.stream.aborted.by_signal')
          return
        }
        fullResponse += token
        tokenCount++
        this.send({ type: SERVER_EVENTS.LLM_TOKEN, token })

        if (tokenCount === 1) {
          this.diagnostics.add({
            source: 'llm',
            type: 'first_token.received',
            durationMs: Date.now() - llmStartTime
          })
        }
      }

      if (signal.aborted) return

      this.diagnostics.add({
        source: 'llm',
        type: 'stream.completed',
        durationMs: Date.now() - llmStartTime,
        metadata: { totalTokens: tokenCount }
      })

      this.logger.info({ sessionId: this.sessionId, responseLength: fullResponse.length }, 'llm.complete')
      this.send({ type: SERVER_EVENTS.LLM_COMPLETE })
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

    this.diagnostics.add({
      source: 'tts',
      type: 'stream.started',
      turnId: this.currentTurnId || undefined
    })

    this.diagnostics.updateState({ audio: { playing: true } })

    try {
      for await (const audioChunk of this.ttsWorker.stream(text, signal, this.logger)) {
        if (signal.aborted) return
        if (audioChunk.length === 0) continue
        this.sendBinary(audioChunk)
        this.diagnostics.add({
          source: 'tts',
          type: 'chunk.received',
          metadata: { size: audioChunk.length }
        })
      }

      if (signal.aborted) return

      this.diagnostics.add({
        source: 'tts',
        type: 'stream.completed'
      })

      this.diagnostics.updateState({ audio: { playing: false } })

      this.logger.info({ sessionId: this.sessionId }, 'tts.complete')
      this.actor.send({ type: 'SPEAK_COMPLETE' })
      this.send({ type: SERVER_EVENTS.TTS_COMPLETE })
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
      case 'audio.start':
        this.handleAudioStart(msg.turnId)
        break
      case 'audio.commit':
        this.handleAudioCommit(msg.turnId, msg.finalSeq)
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
      case 'submit.text':
        this.handleTextSubmit(msg.text)
        break
      case CLIENT_EVENTS.READALOUD_START:
        this.handleReadAloudStart(msg.messageId, msg.text)
        break
      default:
        this.logger.warn({ sessionId: this.sessionId, type: msg.type }, 'unknown.message.type')
    }
  }

  handleBinaryFrame(pcmData: Buffer, seq: number): void {
    this.frameBuffer.set(seq, pcmData)
    this.currentSeq = seq

    if (this.asrFrameQueue !== undefined) {
      this.asrFrameQueue.push(pcmData)
    }

    this.logger.info({ sessionId: this.sessionId, seq, size: pcmData.length, queueLength: this.asrFrameQueue.length, hasAsrStream: !!this.asrStreamTask }, 'audio.frame.received')
  }

  private handleSessionInit(): void {
    this.actor.send({ type: 'START' })
    this.send({ type: SERVER_EVENTS.SESSION_STARTED })
    this.sendStateUpdate()
    this.logger.info({ sessionId: this.sessionId }, 'session.established')
  }

  private handleAudioStart(turnId: string): void {
    // If state is not IDLE/LISTENING (e.g., previous turn still in TRANSCRIBING),
    // reset to IDLE first so the new turn can properly start.
    if (this._state !== CONVERSATION_STATES.IDLE && this._state !== CONVERSATION_STATES.LISTENING) {
      this.logger.info({ sessionId: this.sessionId, state: this._state }, 'audio.start.resetting.state')
      this.stopStreamingAsr()
      this.actor.send({ type: 'RESET' })
    }

    this.currentTurnId = turnId
    this.currentSeq = 0
    this.frameBuffer.clear()
    this.asrFrameQueue = []
    this.actor.send({ type: 'START' })
    this.send({ type: SERVER_EVENTS.SESSION_STARTED })
    this.sendStateUpdate()
    this.logger.info({ sessionId: this.sessionId, turnId, state: this._state, queueLength: this.asrFrameQueue.length }, 'audio.start')

    this.startStreamingAsr()
  }

  private startStreamingAsr(): void {
    if (this.asrStreamTask) {
      return
    }

    this.asrStreamController = new AbortController()
    const signal = this.asrStreamController.signal

    const audioStream = this.createFrameStream()

    this.asrStreamTask = (async () => {
      try {
        for await (const result of this.asrWorker.stream(audioStream, signal, this.logger)) {
          if (signal.aborted) break
          if (!result.isFinal) {
            this.logger.info({ sessionId: this.sessionId, text: result.text, turnId: this.currentTurnId }, 'asr.partial.result')
            this.send({
              type: SERVER_EVENTS.ASR_PARTIAL,
              turnId: this.currentTurnId,
              seq: this.currentSeq,
              text: result.text
            })
          } else {
            this.currentTranscript = result.text
            this.logger.info({ sessionId: this.sessionId, text: result.text, turnId: this.currentTurnId }, 'asr.final.result')
            this.send({
              type: SERVER_EVENTS.ASR_FINAL,
              turnId: this.currentTurnId,
              text: result.text
            })
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          this.logger.error({ sessionId: this.sessionId, err }, 'asr.stream.error')
        }
      }
      this.asrStreamTask = null
    })()

    this.logger.info({ sessionId: this.sessionId, hasExistingTask: !!this.asrStreamTask }, 'asr.stream.started')
  }

  private createFrameStream(): AsyncIterable<Buffer> {
    return {
      [Symbol.asyncIterator]: () => {
        return {
          next: async (): Promise<IteratorResult<Buffer>> => {
            while (this.asrFrameQueue.length === 0) {
              if (this.asrStreamController?.signal.aborted) {
                return { done: true, value: Buffer.alloc(0) }
              }
              if (this.asrStreamController === null) {
                return { done: true, value: Buffer.alloc(0) }
              }
              await new Promise(resolve => setTimeout(resolve, 10))
            }
            const frame = this.asrFrameQueue.shift()!
            if (frame.length === 0 && this.asrFrameQueue.length === 0) {
              return { done: true, value: Buffer.alloc(0) }
            }
            return { done: false, value: frame }
          }
        }
      }
    }
  }

  private stopStreamingAsr(): void {
    if (this.asrStreamController) {
      this.asrStreamController.abort()
      this.asrStreamController = null
    }
    this.asrFrameQueue = []
    this.asrStreamTask = null
  }

  private async handleAudioCommit(turnId: string, finalSeq: number): Promise<void> {
    assertNotNull(this.currentTurnId, 'turnId must be set before audio commit')
    // Allow commit from LISTENING or TRANSCRIBING (previous turn may still be in TRANSCRIBING)
    if (this._state !== CONVERSATION_STATES.LISTENING && this._state !== CONVERSATION_STATES.TRANSCRIBING) {
      this.logger.warn({ sessionId: this.sessionId, state: this._state }, 'audio.commit.invalid.state')
      return
    }
    if (turnId !== this.currentTurnId) {
      this.logger.warn({ sessionId: this.sessionId, turnId, expected: this.currentTurnId }, 'audio.commit.turnId.mismatch')
      return
    }

    this.logger.info({ sessionId: this.sessionId, turnId, finalSeq }, 'audio.commit.received')

    for (let i = 0; i <= finalSeq; i++) {
      if (!this.frameBuffer.has(i)) {
        this.logger.warn({ sessionId: this.sessionId, missingSeq: i }, 'audio.commit.missing.seq')
      }
    }

    this.frameBuffer.clear()

    this.actor.send({ type: 'VAD_END' })
    this.eventBus.emit('vad.ended')

    this.asrFrameQueue.push(Buffer.alloc(0))

    const task = this.asrStreamTask
    if (task) {
      this.logger.info({ sessionId: this.sessionId, turnId, queueLength: this.asrFrameQueue.length }, 'asr.commit.awaiting.stream')
      await task
      // Only clear if no new turn has started a new stream in the meantime
      if (this.asrStreamTask === task) {
        this.asrStreamTask = null
        this.asrStreamController = null
        this.logger.info({ sessionId: this.sessionId, turnId }, 'asr.stream.cleared')
      } else {
        this.logger.info({ sessionId: this.sessionId, turnId }, 'asr.stream.skipped.clear.new.turn.active')
      }
    } else {
      this.logger.warn({ sessionId: this.sessionId, turnId }, 'asr.commit.no.stream.running')
    }

    this.logger.info({ sessionId: this.sessionId, turnId }, 'asr.stream.finalized')
  }

  private handleTextSubmit(text: string): void {
    if (!text || this.abortController.signal.aborted) return
    this.currentTranscript = text
    if (!this.currentTurnId) {
      this.currentTurnId = `text-turn-${Date.now()}`
    }
    // Text submit does not broadcast asr.final back to client (client already knows the text)
    this.logger.info({ sessionId: this.sessionId, state: this._state, text }, 'submit.text received, starting LLM')
    this.actor.send({ type: 'ASR_COMPLETE', text })

    // DEBUG: Check actor state after sending
    const snapshot = this.actor.getSnapshot()
    this.logger.info({ sessionId: this.sessionId, actorState: snapshot.value }, 'actor_state_after_asr_complete')
  }

  private async handleReadAloudStart(messageId: string, text: string): Promise<void> {
    this.logger.info({ sessionId: this.sessionId, messageId, textLength: text.length }, 'readAloud.start')
    
    // Send started event
    this.send({ type: SERVER_EVENTS.READALOUD_STARTED, messageId })
    
    try {
      // Use a new AbortController for readAloud (independent from session)
      const readAloudAbortController = new AbortController()
      const signal = readAloudAbortController.signal
      
      // Stream TTS audio chunks
      for await (const audioChunk of this.ttsWorker.stream(text, signal, this.logger)) {
        if (signal.aborted) {
          this.logger.info({ sessionId: this.sessionId, messageId }, 'readAloud.aborted')
          return
        }
        if (audioChunk.length === 0) continue
        this.sendBinary(audioChunk)
      }
      
      // Send complete event
      this.send({ type: SERVER_EVENTS.READALOUD_COMPLETE, messageId })
      this.logger.info({ sessionId: this.sessionId, messageId }, 'readAloud.complete')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.logger.info({ sessionId: this.sessionId, messageId }, 'readAloud.aborted')
        return
      }
      this.logger.error({ sessionId: this.sessionId, messageId, err }, 'readAloud.error')
      this.send({ type: SERVER_EVENTS.RUNTIME_ERROR, error: 'Read aloud failed', code: 4004 })
    }
  }

  private async startTranscribingWithAudio(audioData: Buffer): Promise<void> {
    if (audioData.length === 0) {
      this.logger.warn({ sessionId: this.sessionId }, 'no.audio.to.transcribe')
      this.actor.send({ type: 'ASR_COMPLETE', text: '' })
      return
    }

    const signal = this.abortController.signal

    this.logger.info({ sessionId: this.sessionId, audioBytes: audioData.length }, 'asr.started')

    try {
      const audioStream = (async function* (): AsyncIterable<Buffer> {
        yield audioData
      })()

      let finalText = ''
      for await (const result of this.asrWorker.stream(audioStream, signal, this.logger)) {
        if (signal.aborted) return
        if (!result.isFinal) {
          this.send({ type: SERVER_EVENTS.ASR_PARTIAL, text: result.text })
        } else {
          finalText = result.text
          this.send({ type: SERVER_EVENTS.ASR_FINAL, text: finalText })
        }
      }

      if (signal.aborted) {
        this.logger.warn({ sessionId: this.sessionId }, 'asr.aborted.before.complete')
        return
      }
      this.logger.info({ sessionId: this.sessionId, finalText }, 'asr.complete.sending')
      this.actor.send({ type: 'ASR_COMPLETE', text: finalText })
      this.currentTranscript = finalText
      this.logger.info({ sessionId: this.sessionId, text: finalText }, 'asr.complete')
    } catch (err) {
      this.logger.error({ sessionId: this.sessionId, err }, 'asr.for_await_error')
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
    this.frameBuffer.clear()
    this.diagnostics.add({
      source: 'conversation.machine',
      type: 'interrupt.received',
      turnId: this.currentTurnId || undefined,
      metadata: { reason: 'user' }
    })
    this.actor.send({ type: 'INTERRUPT' })
    this.sendStateUpdate()
    this.eventBus.emit('interrupt.detected', 'user')
    this.sendPlaybackCompleted(true)
  }

  private sendPong(): void {
    this.send({ type: 'pong' })
  }

  private sendDiagnostics(): void {
    this.send({ type: 'diagnostics', metrics: this.diagnostics.snapshot() })
  }

  private sendStateUpdate(): void {
    this.send({ type: 'state.update', state: this._state, turnId: this.currentTurnId })
  }

  handleError(worker: 'asr' | 'llm' | 'tts', error: Error): void {
    this.diagnostics.add({
      source: worker,
      type: 'stream.error',
      metadata: { error: error.message }
    })
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
    this.frameBuffer.clear()
  }

  send(msg: any): void {
    invariant(this.ws.readyState === this.ws.OPEN, 'ws must be OPEN before sending JSON message')
    try {
      this.ws.send(JSON.stringify(msg))
    } catch (err) {
      this.logger.error({ sessionId: this.sessionId, err }, 'send.failed')
    }
  }

  sendBinary(data: Buffer): void {
    invariant(this.ws.readyState === this.ws.OPEN, 'ws must be OPEN before sending binary data')
    invariant(data != null && data.length > 0, 'binary data must be non-empty')
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
    this.frameBuffer.clear()
    this.abortController.abort()
  }
}
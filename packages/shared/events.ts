import { EventEmitter } from 'events'

export interface SessionEvents {
  'audio.chunk.received': [chunk: Buffer]
  'vad.started': []
  'vad.ended': []
  'asr.partial': [text: string]
  'asr.final': [text: string]
  'llm.started': []
  'llm.token': [token: string]
  'llm.completed': []
  'tts.started': []
  'tts.chunk': [audio: Buffer]
  'tts.completed': []
  'playback.started': []
  'playback.chunk': [audio: Buffer]
  'playback.completed': []
  'playback.underrun': []
  'interrupt.detected': [reason: 'user' | 'error' | 'timeout']
  'runtime.error': [error: Error, worker: 'asr' | 'llm' | 'tts' | 'system']
}

export class SessionEventBus extends EventEmitter {
  on<K extends keyof SessionEvents>(event: K, listener: (...args: SessionEvents[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }

  off<K extends keyof SessionEvents>(event: K, listener: (...args: SessionEvents[K]) => void): this {
    return super.off(event, listener as (...args: unknown[]) => void)
  }

  once<K extends keyof SessionEvents>(event: K, listener: (...args: SessionEvents[K]) => void): this {
    return super.once(event, listener as (...args: unknown[]) => void)
  }

  emit<K extends keyof SessionEvents>(event: K, ...args: SessionEvents[K]): boolean {
    return super.emit(event, ...args)
  }

  removeAllListeners<K extends keyof SessionEvents>(event?: K): this {
    return super.removeAllListeners(event as string | symbol)
  }
}
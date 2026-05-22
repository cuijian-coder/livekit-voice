export const CLIENT_EVENTS = {
  SESSION_START: 'session.start',
  SESSION_STOP: 'session.stop',
  AUDIO_CHUNK_APPEND: 'audio.chunk.append',
  AUDIO_COMMIT: 'audio.commit',
  AUDIO_START: 'audio.start',
  TURN_CANCEL: 'turn.cancel',
  INTERRUPT_REQUEST: 'interrupt.request',
  READALOUD_START: 'readAloud.start',
  VAD_START: 'vad.start',
  VAD_END: 'vad.end',
  PING: 'ping',
  GET_DIAGNOSTICS: 'getDiagnostics',
} as const

export const SERVER_EVENTS = {
  SESSION_STARTED: 'session.started',
  SESSION_ERROR: 'session.error',
  STATE_UPDATE: 'state.update',
  ASR_PARTIAL: 'asr.partial',
  ASR_FINAL: 'asr.final',
  LLM_STARTED: 'llm.started',
  LLM_TOKEN: 'llm.token',
  LLM_COMPLETE: 'llm.complete',
  TTS_STARTED: 'tts.started',
  TTS_CHUNK: 'tts.chunk',
  TTS_COMPLETE: 'tts.complete',
  READALOUD_STARTED: 'readAloud.started',
  READALOUD_COMPLETE: 'readAloud.complete',
  PLAYBACK_START: 'playback.start',
  PLAYBACK_CHUNK: 'playback.chunk',
  PLAYBACK_STOP: 'playback.stop',
  PLAYBACK_UNDERRUN: 'playback.underrun',
  INTERRUPT_DETECTED: 'interrupt.detected',
  RUNTIME_ERROR: 'runtime.error',
  RUNTIME_WARNING: 'runtime.warning',
  DIAGNOSTICS: 'diagnostics',
  PONG: 'pong',
} as const

export const INTERNAL_EVENTS = {
  VAD_STARTED: 'vad.started',
  VAD_ENDED: 'vad.ended',
  PIPELINE_STALLED: 'pipeline.stalled',
  STREAM_ERROR: 'stream.error',
} as const

export type ClientEventName = typeof CLIENT_EVENTS[keyof typeof CLIENT_EVENTS]
export type ServerEventName = typeof SERVER_EVENTS[keyof typeof SERVER_EVENTS]
export type InternalEventName = typeof INTERNAL_EVENTS[keyof typeof INTERNAL_EVENTS]
export type RuntimeEventName = ClientEventName | ServerEventName | InternalEventName
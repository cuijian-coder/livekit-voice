export type UserEvent =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'INTERRUPT' }
  | { type: 'SUBMIT_TEXT'; text: string };

export type SystemEvent =
  | { type: 'ASR_PARTIAL'; text: string }
  | { type: 'ASR_FINAL'; text: string }
  | { type: 'STREAM_STARTED' }
  | { type: 'LLM_CHUNK'; text: string }
  | { type: 'LLM_DONE'; fullText: string }
  | { type: 'TTS_STARTED' }
  | { type: 'TTS_FINISHED' }
  | { type: 'ERROR'; error: string };

export type VoiceEvent = UserEvent | SystemEvent;

export function isUserEvent(event: VoiceEvent): event is UserEvent {
  const type = (event as { type: string }).type;
  return type === 'START_RECORDING' || type === 'STOP_RECORDING' || type === 'INTERRUPT' || type === 'SUBMIT_TEXT';
}

export function isSystemEvent(event: VoiceEvent): event is SystemEvent {
  return !isUserEvent(event);
}
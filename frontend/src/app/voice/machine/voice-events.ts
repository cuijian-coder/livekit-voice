export type UserEvent =
  | { type: 'session.start' }
  | { type: 'audio.commit' }
  | { type: 'audio.commit.manual' }
  | { type: 'interrupt.request' }
  | { type: 'SUBMIT_TEXT'; text: string };

export type SystemEvent =
  | { type: 'asr.partial'; text: string }
  | { type: 'asr.final'; text: string; sentenceId?: number }
  | { type: 'llm.started' }
  | { type: 'llm.token'; text: string }
  | { type: 'llm.complete'; fullText: string }
  | { type: 'tts.started' }
  | { type: 'tts.complete' }
  | { type: 'playback.complete' }
  | { type: 'turn.start'; turnId: string }
  | { type: 'INTERRUPTING' }
  | { type: 'runtime.error'; error: string };

export type VoiceEvent = UserEvent | SystemEvent;

export function isUserEvent(event: VoiceEvent): event is UserEvent {
  const type = (event as { type: string }).type;
  return type === 'session.start' || type === 'audio.commit' || type === 'audio.commit.manual' || type === 'interrupt.request' || type === 'SUBMIT_TEXT';
}

export function isSystemEvent(event: VoiceEvent): event is SystemEvent {
  return !isUserEvent(event);
}
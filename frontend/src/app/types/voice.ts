export type VoiceState = 'ready' | 'listening' | 'thinking' | 'speaking';

export interface VoiceStateData {
  state: VoiceState;
  duration: number;
  volume: number;
}

export type VoiceAction =
  | { type: 'SET_STATE'; payload: VoiceState }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'RESET' };
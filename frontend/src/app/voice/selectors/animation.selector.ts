import { CONVERSATION_STATES } from '@livekit-voice/shared/constants';

const s = CONVERSATION_STATES;

export interface AnimationViewModel {
  type: 'none' | 'pulse' | 'spin' | 'wave';
}

export function selectAnimation(snapshot: any): AnimationViewModel {
  const state = snapshot.value as string;

  if (state === s.LISTENING) {
    return { type: 'pulse' };
  }

  if (state === s.THINKING) {
    return { type: 'spin' };
  }

  if (state === s.SPEAKING || state === s.TRANSCRIBING) {
    return { type: 'wave' };
  }

  return { type: 'none' };
}
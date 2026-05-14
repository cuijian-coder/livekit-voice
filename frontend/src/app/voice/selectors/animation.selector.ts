export interface AnimationViewModel {
  type: 'none' | 'pulse' | 'spin' | 'wave';
}

export function selectAnimation(
  snapshot: any
): AnimationViewModel {
  const state = snapshot.value as string;

  if (state === 'listening') {
    return { type: 'pulse' };
  }

  if (state === 'thinking') {
    return { type: 'spin' };
  }

  if (state === 'streaming') {
    return { type: 'wave' };
  }

  return { type: 'none' };
}
import { getLogger } from '../logger';
import { invariant } from './invariant';
import type { VoiceContext } from '../../voice/machine/voice-context';

const STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  TRANSCRIBING: 'transcribing',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  INTERRUPTING: 'interrupting',
  RECOVERING: 'recovering',
  ERROR: 'error',
} as const;

type StateName = typeof STATES[keyof typeof STATES];

const VALID_TRANSITIONS: Record<StateName, StateName[]> = {
  idle: [STATES.LISTENING, STATES.THINKING, STATES.ERROR],
  listening: [STATES.TRANSCRIBING, STATES.IDLE, STATES.INTERRUPTING],
  transcribing: [STATES.THINKING, STATES.IDLE, STATES.INTERRUPTING, STATES.ERROR],
  thinking: [STATES.SPEAKING, STATES.IDLE, STATES.INTERRUPTING, STATES.ERROR],
  speaking: [STATES.IDLE, STATES.INTERRUPTING, STATES.ERROR],
  interrupting: [STATES.IDLE],
  recovering: [STATES.IDLE],
  error: [STATES.IDLE, STATES.RECOVERING],
};

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface TransitionResult {
  valid: boolean;
  reason?: string;
}

export function validateVoiceState(snapshot: any): ValidationResult {
  const logger = getLogger();
  const errors: string[] = [];
  const warnings: string[] = [];
  const state = snapshot.value as string;
  const ctx: VoiceContext = snapshot.context;

  try {
    invariant(!!ctx?.requestId, 'requestId is required', { state });

    if (state === STATES.SPEAKING) {
      invariant(!!ctx?.streamBuffer?.length, 'streamBuffer required for speaking', { state });
    }

    if (state === STATES.THINKING) {
      invariant(!!ctx?.abortController, 'abortController required in thinking state', { state });
    }

    if (state === STATES.SPEAKING && ctx?.abortController) {
      warnings.push('abortController should be undefined in speaking state');
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    errors.push(message);
    logger.warn('[VALIDATION] state validation failed', { state, error: message });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateTransition(
  prevState: string,
  eventType: string,
  nextState: string
): TransitionResult {
  const validTargets = VALID_TRANSITIONS[prevState as StateName];

  if (!validTargets) {
    return { valid: false, reason: `Unknown prevState: ${prevState}` };
  }

  if (!validTargets.includes(nextState as StateName)) {
    return {
      valid: false,
      reason: `Invalid transition: ${prevState} -> ${nextState} via ${eventType}`,
    };
  }

  return { valid: true };
}
import { getLogger } from '../logger'
import { invariant } from './invariant'
import type { VoiceContext } from '../../voice/machine/voice-context'

type VoiceState = 'idle' | 'listening' | 'thinking' | 'streaming' | 'playing' | 'error'

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

interface TransitionResult {
  valid: boolean
  reason?: string
}

export function validateVoiceState(snapshot: any): ValidationResult {
  const logger = getLogger()
  const errors: string[] = []
  const warnings: string[] = []
  const state = snapshot.value as VoiceState
  const ctx: VoiceContext = snapshot.context

  try {
    invariant(!!ctx?.requestId, 'requestId is required', { state })

    if (state === 'streaming' || state === 'playing') {
      invariant(!!ctx?.streamBuffer?.length, 'streamBuffer required for streaming/playing', { state })
    }

    if (state === 'thinking') {
      invariant(!!ctx?.abortController, 'abortController required in thinking state', { state })
    }

    if (state === 'playing' && ctx?.abortController) {
      warnings.push('abortController should be undefined in playing state')
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    errors.push(message)
    logger.warn('[VALIDATION] state validation failed', { state, error: message })
  }

  return { valid: errors.length === 0, errors, warnings }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  idle: ['listening', 'thinking', 'error'],
  listening: ['thinking', 'idle'],
  thinking: ['streaming', 'idle'],
  streaming: ['playing', 'idle'],
  playing: ['idle'],
  error: ['idle', 'thinking']
}

export function validateTransition(
  prevState: string,
  eventType: string,
  nextState: string
): TransitionResult {
  const validTargets = VALID_TRANSITIONS[prevState]

  if (!validTargets) {
    return { valid: false, reason: `Unknown prevState: ${prevState}` }
  }

  if (!validTargets.includes(nextState)) {
    return {
      valid: false,
      reason: `Invalid transition: ${prevState} -> ${nextState} via ${eventType}`
    }
  }

  return { valid: true }
}
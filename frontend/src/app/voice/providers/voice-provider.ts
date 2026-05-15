import { createActor } from 'xstate';
import { voiceMachine } from '../machine';
import { getLogger } from '@livekit-voice/shared/logger';
import { validateVoiceState, validateTransition, timeline } from '../../core/diagnostics';

const logger = getLogger();

export const voiceActor = createActor(voiceMachine);

let prevState = 'idle'
let currentRequestId: string | undefined

voiceActor.subscribe((snapshot: any) => {
  const state = snapshot.value as string

  if (state !== prevState) {
    const result = validateTransition(prevState, 'transition', state)
    if (!result.valid) {
      logger.warn('voice.transition.invalid', { from: prevState, to: state, reason: result.reason })
    }

    timeline.add('transition', { from: prevState, to: state })
    prevState = state
  }

  const validation = validateVoiceState(snapshot)
  if (!validation.valid) {
    logger.warn('voice.state.invalid', { state, errors: validation.errors })
  }

  currentRequestId = snapshot.context.requestId
  logger.debug('voice.state', { state, requestId: currentRequestId })
  timeline.add('state', { state, requestId: currentRequestId })
});

voiceActor.start();

export function getVoiceActor() {
  return voiceActor;
}
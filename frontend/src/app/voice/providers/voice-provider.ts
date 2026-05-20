import { createActor } from 'xstate';
import { voiceMachine } from '../machine';
import { getLogger } from '@livekit-voice/shared/logger';
import { diagnosticsCollector } from '../../runtime/debug-provider';

const logger = getLogger();

export const voiceActor = createActor(voiceMachine);

let prevState = 'idle'

voiceActor.subscribe((snapshot: any) => {
  const state = snapshot.value as string

  if (state !== prevState) {
    diagnosticsCollector.add({
      source: 'conversation.machine',
      type: 'state.entered',
      metadata: { state, from: prevState },
      turnId: snapshot.context.turnId
    })

    diagnosticsCollector.updateState({
      conversation: { state, turnId: snapshot.context.turnId || '' }
    })

    logger.debug('voice.state', { state, turnId: snapshot.context.turnId })
    prevState = state
  }
});

voiceActor.start();

export function getVoiceActor() {
  return voiceActor;
}
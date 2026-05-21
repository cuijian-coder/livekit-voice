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

    const audioState = {
      recording: state === 'listening' || state === 'transcribing',
      playing: state === 'speaking'
    }

    diagnosticsCollector.updateState({
      conversation: { state, turnId: snapshot.context.turnId || '' },
      audio: audioState
    })

    logger.debug('voice.state', { state, turnId: snapshot.context.turnId })
    prevState = state
  }
});

voiceActor.start();

initEnvironmentDiagnostics()

async function initEnvironmentDiagnostics() {
  diagnosticsCollector.updateState({
    environment: {
      secureContext: window.isSecureContext,
      mediaDevicesSupported: !!navigator.mediaDevices,
      audioContextState: 'unknown',
      userAgent: navigator.userAgent,
    }
  })

  if (navigator.permissions && navigator.mediaDevices) {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      diagnosticsCollector.updateState({
        permissions: { microphone: result.state as 'granted' | 'denied' | 'prompt' }
      })
      result.onchange = () => {
        diagnosticsCollector.updateState({
          permissions: { microphone: result.state as 'granted' | 'denied' | 'prompt' }
        })
      }
    } catch {
      logger.debug('permissions.query not supported')
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const hasAudioInput = devices.some(d => d.kind === 'audioinput')
      diagnosticsCollector.updateState({
        environment: {
          mediaDevicesSupported: hasAudioInput
        }
      })
    } catch {
      logger.debug('enumerateDevices not supported')
    }
  }
}

export function getVoiceActor() {
  return voiceActor;
}
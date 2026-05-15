import { CONVERSATION_STATES } from '@livekit-voice/shared/constants';

const s = CONVERSATION_STATES;

export interface VoiceCapabilities {
  canRecord: boolean;
  canInterrupt: boolean;
  canSubmitText: boolean;
  canMute: boolean;
  isDisabled: boolean;
}

export function selectCapabilities(
  snapshot: any,
  hasInput: boolean
): VoiceCapabilities {
  const state = snapshot.value as string;
  const hasError = snapshot.context.error !== undefined;

  const isProcessing = state === s.THINKING || state === s.SPEAKING || state === s.TRANSCRIBING;
  const isListening = state === s.LISTENING;

  return {
    canRecord: state === s.IDLE && !hasInput && !hasError,
    canInterrupt: isProcessing && !hasError,
    canSubmitText: hasInput && !isProcessing && !hasError,
    canMute: isListening,
    isDisabled: hasError || isProcessing,
  };
}
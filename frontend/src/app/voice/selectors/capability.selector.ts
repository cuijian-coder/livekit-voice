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

  const isProcessing = state === 'thinking' || state === 'streaming' || state === 'playing';
  const isListening = state === 'listening';

  return {
    canRecord: state === 'idle' && !hasInput && !hasError,
    canInterrupt: isProcessing && !hasError,
    canSubmitText: hasInput && !isProcessing && !hasError,
    canMute: isListening,
    isDisabled: hasError || isProcessing,
  };
}
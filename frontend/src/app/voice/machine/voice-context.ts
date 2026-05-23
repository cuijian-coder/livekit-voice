export interface VoiceContext {
  transcript: string;
  partialTranscript: string;
  streamBuffer: string;
  sessionId: string;
  turnId: string;
  requestId: string;
  abortController?: AbortController;
  error?: string;
  toastMessage?: string;
  hasAsrResult: boolean;
  lastAsrActivityAt?: number;
}

export function createInitialContext(): VoiceContext {
  return {
    transcript: '',
    partialTranscript: '',
    streamBuffer: '',
    sessionId: generateSessionId(),
    turnId: '',
    requestId: generateRequestId(),
    abortController: undefined,
    error: undefined,
    toastMessage: undefined,
    hasAsrResult: false,
    lastAsrActivityAt: undefined,
  };
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createNewRequestId(): string {
  return generateRequestId();
}

export function createNewTurnId(): string {
  return generateTurnId();
}
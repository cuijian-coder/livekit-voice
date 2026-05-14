export interface VoiceContext {
  transcript: string;
  partialTranscript: string;
  streamBuffer: string;
  sessionId: string;
  requestId: string;
  abortController?: AbortController;
  error?: string;
}

export function createInitialContext(): VoiceContext {
  return {
    transcript: '',
    partialTranscript: '',
    streamBuffer: '',
    sessionId: generateSessionId(),
    requestId: generateRequestId(),
    abortController: undefined,
    error: undefined,
  };
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createNewRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
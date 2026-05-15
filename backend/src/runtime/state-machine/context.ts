export function createInitialContext(sessionId: string, playbackQueue: any): any {
  return {
    sessionId,
    turnId: '',
    transcript: '',
    partialTranscript: '',
    responseBuffer: '',
    diagnostics: null as any,
    abortControllers: new Map<string, AbortController>(),
    playbackQueue,
  }
}

export function generateTurnId(): string {
  return `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function resetTurnContext(ctx: any): void {
  ctx.turnId = ''
  ctx.transcript = ''
  ctx.partialTranscript = ''
  ctx.responseBuffer = ''
  ctx.abortControllers.clear()
  ctx.diagnostics?.resetLatency()
}
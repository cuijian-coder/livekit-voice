export const PROTOCOL_VERSION = 1
export type PROTOCOL_VERSION = typeof PROTOCOL_VERSION

export interface Envelope<T = unknown> {
  version: number
  type: string
  sessionId: string
  turnId?: string
  sequence?: number
  timestamp: number
  payload: T
}

export function createEnvelope<T>(
  type: string,
  sessionId: string,
  payload: T,
  options?: { turnId?: string; sequence?: number }
): Envelope<T> {
  return {
    version: PROTOCOL_VERSION,
    type,
    sessionId,
    turnId: options?.turnId,
    sequence: options?.sequence,
    timestamp: Date.now(),
    payload,
  }
}

let _sequenceCounter = 0
export function nextSequence(): number {
  return ++_sequenceCounter
}
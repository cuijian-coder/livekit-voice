/**
 * Agent Events - Event type constants for XState machine
 */

export const AGENT_EVENTS = {
  CONNECT: 'agent.connect',
  DISCONNECT: 'agent.disconnect',
  EXECUTE: 'agent.execute',
  CANCEL: 'agent.cancel',
  RESULT: 'agent.result',
  ERROR: 'agent.error',
  STATE_UPDATE: 'agent.state.update',
  LOG: 'agent.log',
  HEARTBEAT: 'agent.heartbeat',
} as const

export type AgentEventType = (typeof AGENT_EVENTS)[keyof typeof AGENT_EVENTS]

/**
 * Agent Protocol - Event-driven WebSocket message types
 *
 * All messages between frontend and Agent use a unified event protocol.
 * This is NOT RPC - it's event-driven, supporting request/response correlation
 * via request_id, real-time streaming, and async state changes.
 */

// ---------------------------------------------------------------------------
// Outgoing messages (Frontend → Agent)
// ---------------------------------------------------------------------------

export interface ExecuteMessage {
  type: 'execute'
  request_id: string
  capability: string
  payload?: Record<string, unknown>
}

export interface CancelMessage {
  type: 'cancel'
  request_id: string
}

export interface HeartbeatAckMessage {
  type: 'heartbeat.ack'
  timestamp: number
}

// ---------------------------------------------------------------------------
// Incoming messages (Agent → Frontend)
// ---------------------------------------------------------------------------

export interface ExecuteResultMessage {
  type: 'execute.result'
  request_id: string
  success: boolean
  capability: string
  result?: Record<string, unknown>
  error?: string
}

export interface RobotStateMessage {
  type: 'robot.state'
  busy: boolean
  position?: { x: number; y: number; z: number }
  status?: string
}

export interface RobotLogMessage {
  type: 'robot.log'
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: number
}

export interface AgentErrorMessage {
  type: 'agent.error'
  message: string
  code?: number
}

export interface HeartbeatMessage {
  type: 'heartbeat'
  timestamp: number
}

// ---------------------------------------------------------------------------
// Union type
// ---------------------------------------------------------------------------

export type AgentMessage =
  | ExecuteMessage
  | ExecuteResultMessage
  | RobotStateMessage
  | RobotLogMessage
  | AgentErrorMessage
  | CancelMessage
  | HeartbeatMessage
  | HeartbeatAckMessage

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isExecuteResult(msg: AgentMessage): msg is ExecuteResultMessage {
  return msg.type === 'execute.result'
}

export function isRobotState(msg: AgentMessage): msg is RobotStateMessage {
  return msg.type === 'robot.state'
}

export function isRobotLog(msg: AgentMessage): msg is RobotLogMessage {
  return msg.type === 'robot.log'
}

export function isAgentError(msg: AgentMessage): msg is AgentErrorMessage {
  return msg.type === 'agent.error'
}

export function isHeartbeat(msg: AgentMessage): msg is HeartbeatMessage {
  return msg.type === 'heartbeat'
}

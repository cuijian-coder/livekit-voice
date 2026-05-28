/**
 * Agent Context - XState machine context type
 */

import type { CapabilityDef } from './capability-registry'
import type { RobotStateMessage, RobotLogMessage } from './agent-protocol'

export interface AgentMachineContext {
  /** Current connection state */
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error'
  /** Robot real-time state */
  robotState: RobotStateMessage | null
  /** Recent robot logs (keep last 100) */
  logs: RobotLogMessage[]
  /** Pending execute requests (for timeout/correlation) */
  pendingRequestIds: Set<string>
  /** Last error message */
  errorMessage: string | null
  /** Available capabilities */
  capabilities: CapabilityDef[]
}

export function createInitialAgentContext(): AgentMachineContext {
  return {
    connectionState: 'disconnected',
    robotState: null,
    logs: [],
    pendingRequestIds: new Set(),
    errorMessage: null,
    capabilities: [],
  }
}

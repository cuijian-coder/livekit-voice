/**
 * Agent Machine - XState v5 state machine for Robot Agent lifecycle
 *
 * States:
 *   disconnected → connecting → idle → executing → busy → idle
 *                                           ↓         ↓
 *                                         error ←─────┘
 *
 * Features:
 * - Auto-connect on startup
 * - Execute capability with request tracking
 * - React to robot.state (busy flag) for physical action state
 * - Collect robot logs with max buffer size
 */

import { createMachine, assign } from 'xstate'
import { createInitialAgentContext, type AgentMachineContext } from './agent-context'
import type { RobotStateMessage, RobotLogMessage, ExecuteResultMessage } from './agent-protocol'
import { CAPABILITY_REGISTRY } from './capability-registry'

const MAX_LOG_BUFFER = 100

export const agentMachine = createMachine({
  id: 'agent',
  initial: 'disconnected',
  context: createInitialAgentContext(),
  states: {
    disconnected: {
      on: {
        'agent.connect': {
          target: 'connecting',
          actions: assign(() => ({ connectionState: 'connecting' as const })),
        },
      },
    },
    connecting: {
      on: {
        'agent.connect': {
          target: 'idle',
          actions: assign(() => ({
            connectionState: 'connected' as const,
            capabilities: Object.values(CAPABILITY_REGISTRY),
          })),
        },
        'agent.error': {
          target: 'error',
          actions: assign(({ event }: { event: any }) => ({
            connectionState: 'error' as const,
            errorMessage: event?.message || 'Connection failed',
          })),
        },
      },
    },
    idle: {
      entry: assign(() => ({ connectionState: 'connected' as const })),
      on: {
        'agent.execute': {
          target: 'executing',
          actions: assign(({ context, event }: { context: AgentMachineContext; event: any }) => ({
            pendingRequestIds: new Set([...context.pendingRequestIds, event?.requestId || 'unknown']),
          })),
        },
        'agent.state.update': {
          actions: assign(({ event }: { event: any }) => ({
            robotState: event?.state as RobotStateMessage,
          })),
        },
        'agent.log': {
          actions: assign(({ context, event }: { context: AgentMachineContext; event: any }) => {
            const newLog = event?.log as RobotLogMessage
            if (!newLog) return { logs: context.logs }
            const logs = [...context.logs, newLog]
            if (logs.length > MAX_LOG_BUFFER) logs.shift()
            return { logs }
          }),
        },
        'agent.disconnect': {
          target: 'disconnected',
          actions: assign(() => ({ connectionState: 'disconnected' as const })),
        },
      },
    },
    executing: {
      on: {
        'agent.result': [
          {
            guard: ({ event }: { event: any }) => {
              const result = event?.result as ExecuteResultMessage
              return result?.success === true && result?.result?.busy === true
            },
            target: 'busy',
            actions: assign(({ context, event }: { context: AgentMachineContext; event: any }) => {
              const result = event?.result as ExecuteResultMessage
              const set = new Set(context.pendingRequestIds)
              if (result?.request_id) set.delete(result.request_id)
              return {
                pendingRequestIds: set,
                robotState: {
                  type: 'robot.state' as const,
                  busy: true,
                  ...(result?.result || {}),
                } as RobotStateMessage,
              }
            }),
          },
          {
            guard: ({ event }: { event: any }) => {
              const result = event?.result as ExecuteResultMessage
              return result?.success === true
            },
            target: 'idle',
            actions: assign(({ context, event }: { context: AgentMachineContext; event: any }) => {
              const result = event?.result as ExecuteResultMessage
              const set = new Set(context.pendingRequestIds)
              if (result?.request_id) set.delete(result.request_id)
              return {
                pendingRequestIds: set,
                robotState: {
                  type: 'robot.state' as const,
                  busy: false,
                  ...(result?.result || {}),
                } as RobotStateMessage,
              }
            }),
          },
          {
            target: 'idle',
            actions: assign(({ context, event }: { context: AgentMachineContext; event: any }) => {
              const result = event?.result as ExecuteResultMessage
              const set = new Set(context.pendingRequestIds)
              if (result?.request_id) set.delete(result.request_id)
              return {
                pendingRequestIds: set,
                errorMessage: result?.error || 'Execute failed',
              }
            }),
          },
        ],
        'agent.error': {
          target: 'idle',
          actions: assign(({ context, event }: { context: AgentMachineContext; event: any }) => {
            const set = new Set(context.pendingRequestIds)
            set.delete(event?.requestId as string)
            return {
              pendingRequestIds: set,
              errorMessage: event?.message || 'Execute error',
            }
          }),
        },
        'agent.state.update': {
          actions: assign(({ event }: { event: any }) => ({
            robotState: event?.state as RobotStateMessage,
          })),
        },
      },
    },
    busy: {
      entry: assign(() => ({ connectionState: 'connected' as const })),
      on: {
        'agent.state.update': [
          {
            guard: ({ event }: { event: any }) => {
              const state = event?.state as RobotStateMessage
              return !state?.busy
            },
            target: 'idle',
            actions: assign(({ event }: { event: any }) => ({
              robotState: event?.state as RobotStateMessage,
            })),
          },
          {
            actions: assign(({ event }: { event: any }) => ({
              robotState: event?.state as RobotStateMessage,
            })),
          },
        ],
        'agent.log': {
          actions: assign(({ context, event }: { context: AgentMachineContext; event: any }) => {
            const newLog = event?.log as RobotLogMessage
            if (!newLog) return { logs: context.logs }
            const logs = [...context.logs, newLog]
            if (logs.length > MAX_LOG_BUFFER) logs.shift()
            return { logs }
          }),
        },
        'agent.disconnect': {
          target: 'disconnected',
          actions: assign(() => ({ connectionState: 'disconnected' as const })),
        },
      },
    },
    error: {
      entry: assign(() => ({ connectionState: 'error' as const })),
      on: {
        'agent.connect': {
          target: 'connecting',
          actions: assign(() => ({
            connectionState: 'connecting' as const,
            errorMessage: null,
          })),
        },
      },
    },
  },
})

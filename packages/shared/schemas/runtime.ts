import { z } from 'zod'

export const ConversationStateSchema = z.enum([
  'idle',
  'listening',
  'transcribing',
  'thinking',
  'speaking',
  'interrupting',
  'recovering',
  'error',
])

export const StateUpdateSchema = z.object({
  state: ConversationStateSchema,
  turnId: z.string(),
})

export const SessionEstablishedSchema = z.object({
  sessionId: z.string(),
  state: ConversationStateSchema,
})

export const SessionErrorSchema = z.object({
  error: z.string(),
  code: z.number(),
})

export const RuntimeErrorSchema = z.object({
  error: z.string(),
  code: z.number(),
})

export const RuntimeWarningSchema = z.object({
  warning: z.string(),
  code: z.number().optional(),
})

export type ConversationState = z.infer<typeof ConversationStateSchema>
export type StateUpdate = z.infer<typeof StateUpdateSchema>
export type SessionEstablished = z.infer<typeof SessionEstablishedSchema>
export type SessionError = z.infer<typeof SessionErrorSchema>
export type RuntimeError = z.infer<typeof RuntimeErrorSchema>
export type RuntimeWarning = z.infer<typeof RuntimeWarningSchema>
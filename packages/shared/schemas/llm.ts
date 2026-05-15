import { z } from 'zod'

export const LlmTokenSchema = z.object({
  text: z.string(),
  delta: z.boolean().optional(),
})

export const LlmCompleteSchema = z.object({
  fullText: z.string(),
  finishReason: z.string().optional(),
})

export const LlmStartedSchema = z.object({
  model: z.string().optional(),
})

export type LlmToken = z.infer<typeof LlmTokenSchema>
export type LlmComplete = z.infer<typeof LlmCompleteSchema>
export type LlmStarted = z.infer<typeof LlmStartedSchema>
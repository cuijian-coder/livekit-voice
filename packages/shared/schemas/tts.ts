import { z } from 'zod'

export const TtsStartedSchema = z.object({
  voice: z.string().optional(),
  format: z.string().optional(),
})

export const TtsChunkSchema = z.object({
  audioData: z.string(),
  sequence: z.number().int().nonnegative().optional(),
  isFinal: z.boolean().optional(),
})

export const TtsCompleteSchema = z.object({
  durationMs: z.number().nonnegative().optional(),
})

export type TtsStarted = z.infer<typeof TtsStartedSchema>
export type TtsChunk = z.infer<typeof TtsChunkSchema>
export type TtsComplete = z.infer<typeof TtsCompleteSchema>
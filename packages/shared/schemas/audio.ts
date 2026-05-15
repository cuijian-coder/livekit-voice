import { z } from 'zod'

export const AudioChunkAppendSchema = z.object({
  chunkId: z.string(),
  sequence: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative().optional(),
})

export const AudioCommitSchema = z.object({
  turnId: z.string(),
})

export type AudioChunkAppend = z.infer<typeof AudioChunkAppendSchema>
export type AudioCommit = z.infer<typeof AudioCommitSchema>
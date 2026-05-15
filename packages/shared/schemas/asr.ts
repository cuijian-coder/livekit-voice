import { z } from 'zod'

export const AsrPartialSchema = z.object({
  text: z.string(),
  stability: z.number().min(0).max(1).optional(),
})

export const AsrFinalSchema = z.object({
  text: z.string(),
})

export type AsrPartial = z.infer<typeof AsrPartialSchema>
export type AsrFinal = z.infer<typeof AsrFinalSchema>
import { z } from 'zod'

export const DiagnosticsSchema = z.object({
  stateTransitions: z.array(z.object({
    from: z.string().nullable(),
    to: z.string(),
    ts: z.number(),
  })),
  interruptions: z.array(z.object({
    turnId: z.string(),
    reason: z.enum(['user', 'error', 'timeout']),
    ts: z.number(),
  })),
  websocketReconnects: z.number().int().nonnegative(),
  audioUnderruns: z.number().int().nonnegative(),
  streamErrors: z.array(z.object({
    worker: z.enum(['asr', 'llm', 'tts']),
    error: z.string(),
    ts: z.number(),
  })),
  latency: z.object({
    asrStart: z.number().nullable(),
    llmFirstToken: z.number().nullable(),
    ttsFirstChunk: z.number().nullable(),
    playbackStart: z.number().nullable(),
  }),
})

export type Diagnostics = z.infer<typeof DiagnosticsSchema>
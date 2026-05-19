import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

loadEnv()

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  QWEN_API_KEY: z.string(),
  QWEN_API_BASE: z.string().default('https://dashscope.aliyuncs.com/compatible-mode/v1'),
  ASR_MODEL: z.string().default('fun-asr-realtime'),
  ASR_FORMAT: z.string().default('pcm'),
  ASR_SAMPLE_RATE: z.coerce.number().default(16000),
  LLM_MODEL: z.string().default('qwen-turbo'),
  LLM_TEMPERATURE: z.coerce.number().default(0.7),
  LLM_MAX_TOKENS: z.coerce.number().default(2000),
  TTS_MODEL: z.string().default('cosyvoice-v3-flash'),
  TTS_VOICE: z.string().default('xiaoyun'),
  TTS_FORMAT: z.string().default('wav'),
  TTS_SAMPLE_RATE: z.coerce.number().default(16000),
  NLS_TTS_APPKEY: z.string().default(''),
  NLS_TTS_TOKEN: z.string().default(''),
  NLS_TTS_VOICE: z.string().default('xiaoyun'),
  NLS_TTS_FORMAT: z.string().default('wav'),
  NLS_TTS_SAMPLE_RATE: z.coerce.number().default(16000),
  NLS_TTS_WEBSOCKET_URL: z.string().default('wss://nls-gateway-cn-beijing.aliyuncs.com/ws/v1'),
  TTS_MODE: z.enum(['http', 'websocket']).default('http'),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().default(30000),
  HEARTBEAT_TIMEOUT_MS: z.coerce.number().default(60000),
})

let configInstance: z.infer<typeof ConfigSchema> | null = null

export function getConfig(): z.infer<typeof ConfigSchema> {
  if (configInstance) return configInstance

  const raw = {
    PORT: process.env.PORT,
    HOST: process.env.HOST,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    QWEN_API_KEY: process.env.QWEN_API_KEY,
    QWEN_API_BASE: process.env.QWEN_API_BASE,
    ASR_MODEL: process.env.ASR_MODEL,
    ASR_FORMAT: process.env.ASR_FORMAT,
    ASR_SAMPLE_RATE: process.env.ASR_SAMPLE_RATE,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_TEMPERATURE: process.env.LLM_TEMPERATURE,
    LLM_MAX_TOKENS: process.env.LLM_MAX_TOKENS,
    TTS_MODEL: process.env.TTS_MODEL,
    TTS_VOICE: process.env.TTS_VOICE,
    TTS_FORMAT: process.env.TTS_FORMAT,
    TTS_SAMPLE_RATE: process.env.TTS_SAMPLE_RATE,
    NLS_TTS_APPKEY: process.env.NLS_TTS_APPKEY,
    NLS_TTS_TOKEN: process.env.NLS_TTS_TOKEN,
    NLS_TTS_VOICE: process.env.NLS_TTS_VOICE,
    NLS_TTS_FORMAT: process.env.NLS_TTS_FORMAT,
    NLS_TTS_SAMPLE_RATE: process.env.NLS_TTS_SAMPLE_RATE,
    NLS_TTS_WEBSOCKET_URL: process.env.NLS_TTS_WEBSOCKET_URL,
    TTS_MODE: process.env.TTS_MODE,
    HEARTBEAT_INTERVAL_MS: process.env.HEARTBEAT_INTERVAL_MS,
    HEARTBEAT_TIMEOUT_MS: process.env.HEARTBEAT_TIMEOUT_MS,
  }

  const result = ConfigSchema.safeParse(raw)
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
    throw new Error(`Config validation failed: ${errors}`)
  }

  configInstance = result.data
  return configInstance
}

export function resetConfig(): void {
  configInstance = null
}

export type Config = z.infer<typeof ConfigSchema>
export { ConfigSchema }
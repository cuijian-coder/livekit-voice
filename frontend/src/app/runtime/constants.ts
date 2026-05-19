export const AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  micEnergyThreshold: 0.01,
  silenceTimeoutMs: 600,
  minSpeechDurationMs: 300,
} as const

export const TRANSPORT_CONFIG = {
  flushTimeoutMs: 5000,
  maxRetries: 3,
} as const
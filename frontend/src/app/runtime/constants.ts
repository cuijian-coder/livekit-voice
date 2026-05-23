export const AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  micEnergyThreshold: 0.01,
  // 1.5s silence before auto-committing a turn.
  // Prevents chopping sentences on normal pauses (breathing, commas).
  silenceTimeoutMs: 1500,
  // Minimum 500ms of speech for a turn to be considered valid.
  // Filters out accidental noise or very short utterances.
  minSpeechDurationMs: 500,
} as const

export const TRANSPORT_CONFIG = {
  flushTimeoutMs: 5000,
  maxRetries: 3,
} as const
export const CONVERSATION_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  TRANSCRIBING: 'transcribing',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  INTERRUPTING: 'interrupting',
  RECOVERING: 'recovering',
  ERROR: 'error',
} as const

export type ConversationState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'interrupting' | 'recovering' | 'error'

export type ValidTransitions = {
  [K in ConversationState]: ConversationState[]
}

export const VALID_TRANSITIONS: ValidTransitions = {
  idle: ['listening', 'thinking', 'error'],
  listening: ['transcribing', 'idle', 'interrupting'],
  transcribing: ['thinking', 'idle', 'interrupting', 'error'],
  thinking: ['speaking', 'idle', 'interrupting', 'error'],
  speaking: ['idle', 'interrupting', 'error'],
  interrupting: ['idle'],
  recovering: ['idle'],
  error: ['idle', 'recovering'],
} as const
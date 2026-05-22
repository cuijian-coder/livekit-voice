import { createMachine, assign } from 'xstate'
import { CONVERSATION_STATES } from '@livekit-voice/shared/constants'

const s = CONVERSATION_STATES

export type ConversationMachineEvent =
  | { type: 'START' }
  | { type: 'VAD_END' }
  | { type: 'ASR_COMPLETE'; text: string }
  | { type: 'LLM_COMPLETE' }
  | { type: 'SPEAK_COMPLETE' }
  | { type: 'INTERRUPT' }
  | { type: 'ERROR'; error: string }
  | { type: 'RECOVER' }
  | { type: 'RESET' }

export const conversationMachine = createMachine({
  id: 'conversation',
  initial: s.IDLE,
  types: {
    context: {} as any,
    events: {} as ConversationMachineEvent,
  },
  context: {
    sessionId: '',
    turnId: '',
    transcript: '',
    partialTranscript: '',
    responseBuffer: '',
    diagnostics: null as any,
    abortControllers: new Map<string, AbortController>(),
    playbackQueue: null as any,
  },
  states: {
    [s.IDLE]: {
      on: {
        START: s.LISTENING,
        RESET: s.IDLE,
        ASR_COMPLETE: s.THINKING,
      },
    },
    [s.LISTENING]: {
      on: {
        VAD_END: s.TRANSCRIBING,
        ASR_COMPLETE: s.THINKING,
        INTERRUPT: s.INTERRUPTING,
        RESET: s.IDLE,
      },
    },
    [s.TRANSCRIBING]: {
      on: {
        ASR_COMPLETE: { target: s.THINKING },
        INTERRUPT: s.INTERRUPTING,
        ERROR: s.ERROR,
        RESET: s.IDLE,
      },
    },
    [s.THINKING]: {
      on: {
        LLM_COMPLETE: s.SPEAKING,
        INTERRUPT: s.INTERRUPTING,
        ERROR: s.ERROR,
        RESET: s.IDLE,
      },
    },
    [s.SPEAKING]: {
      on: {
        SPEAK_COMPLETE: s.IDLE,
        INTERRUPT: s.INTERRUPTING,
        ERROR: s.ERROR,
        RESET: s.IDLE,
      },
    },
    [s.INTERRUPTING]: {
      entry: assign({
        abortControllers: () => new Map<string, AbortController>(),
        responseBuffer: () => '',
        partialTranscript: () => '',
      }),
      always: s.IDLE,
    },
    [s.RECOVERING]: {
      on: {
        RECOVER: s.IDLE,
        RESET: s.IDLE,
      },
    },
    [s.ERROR]: {
      on: {
        START: s.IDLE,
        RESET: s.IDLE,
        RECOVER: s.RECOVERING,
      },
    },
  },
})
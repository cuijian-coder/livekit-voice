import { setup, assign } from 'xstate';
import { createInitialContext, createNewRequestId, createNewTurnId } from './voice-context';
import type { VoiceEvent } from './voice-events';
import { audioRecorder } from '../../runtime/audio/recorder';
import { getLogger } from '../../shared/logger';

const logger = getLogger();

async function startAudioRecording() {
  try {
    await audioRecorder.start();
    logger.info('audio.recording.started');
  } catch (error) {
    logger.error('audio.recording.error', { error: String(error) });
  }
}

function stopAudioRecording() {
  audioRecorder.stop();
  logger.info('audio.recording.stopped');
}

export const voiceMachine = setup({
  types: {
    context: {} as ReturnType<typeof createInitialContext>,
    events: {} as VoiceEvent,
  },
  actions: {
    resetSession: assign({
      transcript: () => '',
      partialTranscript: () => '',
      streamBuffer: () => '',
      requestId: () => createNewRequestId(),
      turnId: () => '',
      abortController: () => undefined,
      error: () => undefined,
    }),
    startTurn: assign({
      turnId: () => createNewTurnId(),
      abortController: () => undefined,
      streamBuffer: () => '',
    }),
    setAbortController: assign({
      abortController: () => new AbortController(),
    }),
  },
}).createMachine({
  id: 'voice',
  initial: 'idle',
  context: createInitialContext(),
  states: {
    idle: {
      on: {
        'session.start': {
          target: 'listening',
          actions: 'startTurn',
        },
        SUBMIT_TEXT: {
          target: 'thinking',
          actions: ['setAbortController', assign({ requestId: () => createNewRequestId() })],
        },
      },
    },
    listening: {
      entry: () => startAudioRecording(),
      exit: () => stopAudioRecording(),
      on: {
        'audio.commit': {
          target: 'thinking',
          actions: 'setAbortController',
        },
        'interrupt.request': {
          target: 'idle',
          actions: 'resetSession',
        },
      },
    },
    transcribing: {
      on: {
        'llm.started': { target: 'thinking' },
        'interrupt.request': { target: 'idle', actions: 'resetSession' },
        'runtime.error': {
          target: 'error',
          actions: assign({ error: ({ event }: any) => (event as any).error }),
        },
      },
    },
    thinking: {
      on: {
        'llm.complete': {
          target: 'speaking',
          actions: assign({ streamBuffer: ({ event }: any) => (event as any).fullText }),
        },
        'interrupt.request': { target: 'idle', actions: 'resetSession' },
        'runtime.error': {
          target: 'error',
          actions: assign({ error: ({ event }: any) => (event as any).error }),
        },
      },
    },
    speaking: {
      on: {
        'llm.token': {
          actions: assign({ streamBuffer: ({ event }: any) => (event as any).text }),
        },
        'llm.complete': {
          actions: assign({ streamBuffer: ({ event }: any) => (event as any).fullText }),
        },
        'tts.complete': { target: 'idle' },
        'interrupt.request': { target: 'idle', actions: 'resetSession' },
        'runtime.error': {
          target: 'error',
          actions: assign({ error: ({ event }: any) => (event as any).error }),
        },
      },
    },
    interrupting: {
      entry: 'resetSession',
      always: 'idle',
    },
    recovering: {
      on: {
        'session.start': 'idle',
      },
    },
    error: {
      on: {
        'session.start': 'idle',
        SUBMIT_TEXT: 'thinking',
      },
    },
  },
});
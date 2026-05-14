import { setup, assign } from 'xstate';
import { createInitialContext, createNewRequestId } from './voice-context';
import type { VoiceEvent } from './voice-events';
import { audioRecorder } from '../../services/audio-recorder';
import { getLogger } from '../../core/logger';

const logger = getLogger();

async function startAudioRecording() {
  try {
    await audioRecorder.start()
    logger.info('audio.recording.started')
  } catch (error) {
    logger.error('audio.recording.error', { error: String(error) })
  }
}

function stopAudioRecording() {
  audioRecorder.stop()
  logger.info('audio.recording.stopped')
}

export const voiceMachine = setup({
  types: {
    context: {} as ReturnType<typeof createInitialContext>,
    events: {} as VoiceEvent,
  },
}).createMachine({
  id: 'voice',
  initial: 'idle',
  context: createInitialContext(),
  states: {
    idle: {
      on: {
        START_RECORDING: {
          target: 'listening',
          actions: [
            assign({ abortController: () => undefined }),
            assign({ requestId: () => createNewRequestId() }),
            assign({ streamBuffer: () => '' }),
          ],
        },
        SUBMIT_TEXT: {
          target: 'thinking',
          actions: [
            assign({ abortController: () => new AbortController() }),
            assign({ requestId: () => createNewRequestId() }),
          ],
        },
      },
    },
    listening: {
      entry: () => startAudioRecording(),
      exit: () => stopAudioRecording(),
      on: {
        STOP_RECORDING: {
          target: 'thinking',
          actions: assign({ abortController: () => new AbortController() }),
        },
        INTERRUPT: {
          target: 'idle',
          actions: assign({
            transcript: () => '',
            partialTranscript: () => '',
            streamBuffer: () => '',
            requestId: () => createNewRequestId(),
            abortController: () => undefined,
            error: () => undefined,
          }),
        },
      },
    },
    thinking: {
      on: {
        LLM_DONE: {
          target: 'streaming',
          actions: assign({ streamBuffer: ({ event }: any) => event.fullText }),
        },
        INTERRUPT: {
          target: 'idle',
          actions: assign({
            transcript: () => '',
            partialTranscript: () => '',
            streamBuffer: () => '',
            requestId: () => createNewRequestId(),
            abortController: () => undefined,
            error: () => undefined,
          }),
        },
      },
    },
    streaming: {
      on: {
        LLM_CHUNK: {
          actions: assign({ streamBuffer: ({ event }: any) => event.text }),
        },
        LLM_DONE: {
          target: 'playing',
          actions: assign({ streamBuffer: ({ event }: any) => event.fullText }),
        },
        INTERRUPT: {
          target: 'idle',
          actions: assign({
            transcript: () => '',
            partialTranscript: () => '',
            streamBuffer: () => '',
            requestId: () => createNewRequestId(),
            abortController: () => undefined,
            error: () => undefined,
          }),
        },
      },
    },
    playing: {
      on: {
        TTS_FINISHED: {
          target: 'idle',
        },
        INTERRUPT: {
          target: 'idle',
          actions: assign({
            transcript: () => '',
            partialTranscript: () => '',
            streamBuffer: () => '',
            requestId: () => createNewRequestId(),
            abortController: () => undefined,
            error: () => undefined,
          }),
        },
      },
    },
    error: {
      on: {
        START_RECORDING: 'idle',
        SUBMIT_TEXT: 'thinking',
      },
    },
  },
  on: {
    INTERRUPT: {
      target: '#voice.idle',
      actions: assign({
        transcript: () => '',
        partialTranscript: () => '',
        streamBuffer: () => '',
        requestId: () => createNewRequestId(),
        abortController: () => undefined,
        error: () => undefined,
      }),
    },
  },
});
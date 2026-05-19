import { setup, assign } from 'xstate';
import { createInitialContext, createNewRequestId, createNewTurnId } from './voice-context';
import type { VoiceEvent } from './voice-events';
import { audioRecorder } from '../../runtime/audio/recorder';
import { speechDetector } from '../../runtime/audio/speech-detector';
import { binaryTransport } from '../../runtime/transport';
import { wsClient } from '../../runtime/transport/websocket-client';
import { getLogger } from '@livekit-voice/shared/logger';
import { invariant, assertNotNull } from '../../../../../self-healing/assert';

const logger = getLogger();

async function startAudioRecording() {
  try {
    audioRecorder.resetWorkletSeq();
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
    startTurnTransport: ({ context }) => {
      invariant(context.turnId !== '', 'turnId required before startTurnTransport')
      binaryTransport.startTurn(context.turnId)
    },
    commitAudio: async ({ context }) => {
      await binaryTransport.flush()
      await binaryTransport.commit()
    },
    setPartialTranscript: assign({
      partialTranscript: ({ event }: any) => (event as any).text || '',
    }),
    setFinalTranscript: assign({
      transcript: ({ event }: any) => (event as any).text || '',
    }),
    setAssistantSpeakingTrue: () => speechDetector.setAssistantSpeaking(true),
    setAssistantSpeakingFalse: () => speechDetector.setAssistantSpeaking(false),
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
          actions: [
            'startTurn',
            'startTurnTransport',
            ({ context }) => {
              wsClient.send({ type: 'audio.start', turnId: context.turnId } as any)
            }
          ],
        },
        SUBMIT_TEXT: {
          target: 'thinking',
          actions: [
            'setAbortController',
            assign({ requestId: () => createNewRequestId() }),
            ({ event }) => {
              const text = (event as any).text
              if (text) {
                wsClient.send({ type: 'submit.text', text } as any)
              }
            }
          ],
        },
      },
    },
    listening: {
      entry: () => startAudioRecording(),
      on: {
        'audio.commit': {
          target: 'thinking',
          actions: ['setAbortController', 'commitAudio'],
        },
        'asr.partial': { actions: 'setPartialTranscript' },
        'asr.final': { actions: 'setFinalTranscript' },
        'interrupt.request': {
          target: 'idle',
          actions: 'resetSession',
        },
      },
    },
    transcribing: {
      on: {
        'llm.started': { target: 'thinking' },
        'asr.partial': { actions: 'setPartialTranscript' },
        'interrupt.request': { target: 'idle', actions: 'resetSession' },
        'runtime.error': {
          target: 'error',
          actions: assign({ error: ({ event }: any) => (event as any).error }),
        },
      },
    },
    thinking: {
      on: {
        'asr.partial': { actions: 'setPartialTranscript' },
        'asr.final': {
          actions: 'setFinalTranscript',
        },
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
      entry: 'setAssistantSpeakingTrue',
      exit: 'setAssistantSpeakingFalse',
      on: {
        'INTERRUPTING': { target: 'listening', actions: 'resetSession' },
        'llm.token': {
          actions: assign({ streamBuffer: ({ event }: any) => (event as any).text }),
        },
        'llm.complete': {
          actions: assign({ streamBuffer: ({ event }: any) => (event as any).fullText }),
        },
        'tts.complete': { target: 'listening' },
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
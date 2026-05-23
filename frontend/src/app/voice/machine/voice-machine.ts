import { setup, assign } from 'xstate';
import { createInitialContext, createNewRequestId, createNewTurnId } from './voice-context';
import type { VoiceEvent } from './voice-events';
import { audioRecorder } from '../../runtime/audio/recorder';
import { speechDetector } from '../../runtime/audio/speech-detector';
import { utteranceManager } from '../../runtime/audio/utterance-manager';
import { binaryTransport } from '../../runtime/transport';
import { wsClient } from '../../runtime/transport/websocket-client';
import { getLogger } from '@livekit-voice/shared/logger';
import { invariant, assertNotNull } from '../../../../../self-healing/assert';
import { ErrorCodes, parseDomException, getErrorType, ErrorType } from '../../runtime/errors';

const logger = getLogger();

async function startAudioRecording() {
  try {
    audioRecorder.resetWorkletSeq();
    await audioRecorder.start();
    logger.info('audio.recording.started');
  } catch (error) {
    const errorCode = parseDomException(error)
    const errorType = getErrorType(error)
    const metadata = {
      errorType,
      errorCode: errorCode || 'UNKNOWN',
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'UnknownError',
    }
    logger.error('audio.recording.error', metadata)
  }
}

function stopAudioRecording() {
  audioRecorder.stop();
  // Note: audioRecorder.stop() already logs 'audio.recording.stopped' internally
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
      toastMessage: () => undefined,
      hasAsrResult: () => false,
      lastAsrActivityAt: () => undefined,
      manualCommit: () => false,
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
      // Only send audio.start here. binaryTransport is started by UtteranceManager
      // when VAD detects SPEAKING, so we never crash if user stops without speaking.
      wsClient.send({ type: 'audio.start', turnId: context.turnId } as any)
    },
    commitAudio: async () => {
      try {
        await binaryTransport.flush()
        await binaryTransport.commit()
      } catch {
        // binaryTransport may never have been started if user stopped without speaking.
        // UtteranceManager only starts it on VAD SPEAKING.
        logger.warn('audio.commit.noop', { reason: 'binaryTransport not started' })
      }
      utteranceManager.resetTurnState()
    },
    setPartialTranscript: assign({
      partialTranscript: ({ event }: any) => (event as any).text || '',
      hasAsrResult: () => true,
      lastAsrActivityAt: () => Date.now(),
    }),
    setFinalTranscript: assign({
      transcript: ({ event }: any) => (event as any).text || '',
      hasAsrResult: () => true,
      lastAsrActivityAt: () => Date.now(),
    }),
    showEmptyAsrToast: assign({
      toastMessage: () => '未识别文字',
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
      exit: () => stopAudioRecording(),
      on: {
        'audio.commit': {
          target: 'transcribing',
          actions: ['setAbortController', 'commitAudio'],
        },
        'audio.commit.manual': {
          target: 'transcribing',
          actions: [
            'setAbortController',
            'commitAudio',
            assign({ manualCommit: () => true }),
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
        'asr.partial': { actions: 'setPartialTranscript' },
        'asr.final': { actions: 'setFinalTranscript' },
        'interrupt.request': {
          target: 'idle',
          actions: 'resetSession',
        },
      },
    },
    transcribing: {
      entry: assign({ manualCommit: ({ context }: any) => context.manualCommit ?? false }),
      exit: assign({ manualCommit: () => false }),
      on: {
        'asr.partial': {
          // Re-enter transcribing to reset the 15s timeout timer
          target: 'transcribing',
          reenter: true,
          actions: 'setPartialTranscript',
        },
        'asr.final': [
          {
            guard: ({ event }: any) => {
              const text = (event as any).text || ''
              return text.trim().length > 0
            },
            target: 'thinking',
            actions: [
              'setFinalTranscript',
              ({ event }: any) => {
                const text = (event as any).text || ''
                if (text.trim().length > 0) {
                  wsClient.send({ type: 'submit.text', text } as any)
                }
              },
            ],
          },
          {
            target: 'idle',
            actions: ['resetSession', 'showEmptyAsrToast'],
          },
        ],
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
        'asr.final': [
          {
            guard: ({ event }: any) => {
              const text = (event as any).text || ''
              return text.trim().length > 0
            },
            actions: 'setFinalTranscript',
          },
          {
            target: 'idle',
            actions: ['resetSession', 'showEmptyAsrToast'],
          },
        ],
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
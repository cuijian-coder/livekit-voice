import { assign } from 'xstate';
import { createNewRequestId } from './voice-context';

export const voiceActions = {
  setTranscript: assign({
    transcript: ({ event }: { event: { text: string } }) => event.text,
  }),

  setPartialTranscript: assign({
    partialTranscript: ({ event }: { event: { text: string } }) => event.text,
  }),

  clearPartialTranscript: assign({
    partialTranscript: () => '',
  }),

  appendStreamBuffer: assign({
    streamBuffer: ({ event }: { event: { text: string } }) => (_prev: string) => event.text,
  }),

  clearStreamBuffer: assign({
    streamBuffer: () => '',
  }),

  setAbortController: assign({
    abortController: ({ event }: { event: { controller: AbortController } }) => event.controller,
  }),

  clearAbortController: assign({
    abortController: () => undefined,
  }),

  setError: assign({
    error: ({ event }: { event: { error: string } }) => event.error,
  }),

  clearError: assign({
    error: () => undefined,
  }),

  rotateRequestId: assign({
    requestId: () => createNewRequestId(),
  }),

  resetSession: assign({
    transcript: () => '',
    partialTranscript: () => '',
    streamBuffer: () => '',
    requestId: () => createNewRequestId(),
    abortController: () => undefined,
    error: () => undefined,
  }),
};
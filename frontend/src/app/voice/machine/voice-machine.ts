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
import { chatStore } from '../../state/chatStore';

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
      completedSentences: () => [],
      receivedSentenceIds: () => [],
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
      transcript: () => '',
      partialTranscript: () => '',
      completedSentences: () => [],
      receivedSentenceIds: () => [],
      hasAsrResult: () => false,
      lastAsrActivityAt: () => undefined,
      toastMessage: () => undefined,
    }),
    setAbortController: assign({
      abortController: () => new AbortController(),
    }),
    startTurnTransport: ({ context }) => {
      invariant(context.turnId !== '', 'turnId required before startTurnTransport')
      // Sync turnId with utteranceManager so VAD doesn't generate a conflicting id.
      utteranceManager.startTurnSync(context.turnId)
      binaryTransport.startTurn(context.turnId)
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
      partialTranscript: ({ event, context }: any) => {
        const text = (event as any).text || ''
        // 空 partial 不清空已有内容（阿里云 ASR 结束时会发送空 partial）
        if (!text) return context.partialTranscript
        return text
      },
      hasAsrResult: () => true,
      lastAsrActivityAt: () => Date.now(),
    }),
    setFinalTranscript: assign({
      completedSentences: ({ context, event }: any) => {
        const newText = (event as any).text || ''
        if (!newText) return context.completedSentences
        const sentenceId = (event as any).sentenceId as number | undefined
        const currentIds = context.receivedSentenceIds || []
        // 基于 sentenceId 去重（阿里云 ASR 每句有唯一 sentenceId）
        if (sentenceId !== undefined && currentIds.includes(sentenceId)) {
          return context.completedSentences
        }
        return [...context.completedSentences, newText]
      },
      receivedSentenceIds: ({ context, event }: any) => {
        const sentenceId = (event as any).sentenceId as number | undefined
        if (sentenceId === undefined) return context.receivedSentenceIds
        const currentIds = context.receivedSentenceIds || []
        if (currentIds.includes(sentenceId)) return currentIds
        return [...currentIds, sentenceId]
      },
      transcript: ({ context, event }: any) => {
        const newText = (event as any).text || ''
        if (!newText) return context.completedSentences.join('')
        const sentenceId = (event as any).sentenceId as number | undefined
        const currentIds = context.receivedSentenceIds || []
        if (sentenceId !== undefined && currentIds.includes(sentenceId)) {
          return context.completedSentences.join('')
        }
        return [...context.completedSentences, newText].join('')
      },
      // 只在 newText 非空时才清空 partialTranscript，防止空 asr.final
      // 在 listening 状态时提前到达，把已有 partial 清空。
      partialTranscript: ({ context, event }: any) => {
        const newText = (event as any).text || ''
        if (!newText) return context.partialTranscript || ''
        return ''
      },
      hasAsrResult: () => true,
      lastAsrActivityAt: () => Date.now(),
    }),
    showEmptyAsrToast: assign({
      toastMessage: ({ context }: any) => {
        const completed = context.completedSentences || []
        const partial = context.partialTranscript || ''
        const transcript = context.transcript || ''
        logger.warn('asr.empty.result', {
          completedSentences: completed,
          partialTranscript: partial,
          transcript,
          hasAsrResult: context.hasAsrResult,
          lastAsrActivityAt: context.lastAsrActivityAt,
          reason: completed.length === 0 && !partial.trim()
            ? 'completedSentences 和 partialTranscript 均为空'
            : '未知原因（请检查日志）',
        })
        return '未识别文字'
      },
    }),
    setAssistantSpeakingTrue: () => speechDetector.setAssistantSpeaking(true),
    setAssistantSpeakingFalse: () => speechDetector.setAssistantSpeaking(false),
    appendPartialToCompleted: assign({
      completedSentences: ({ context }: any) => {
        const partial = context.partialTranscript?.trim() || ''
        if (!partial) return context.completedSentences
        return [...context.completedSentences, partial]
      },
      transcript: ({ context }: any) => {
        const partial = context.partialTranscript?.trim() || ''
        if (!partial) return context.completedSentences.join('')
        return [...context.completedSentences, partial].join('')
      },
      partialTranscript: () => '',
    }),
    submitTranscript: ({ context }: any) => {
      const text = context.completedSentences.join('')
      if (text) {
        chatStore.addMessage('user', text)
        wsClient.send({ type: 'submit.text', text } as any)
      }
    },
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
            // 1. 有 final 文字 → 去重 push 到 completedSentences，然后提交
            guard: ({ event }: any) => {
              const text = (event as any).text || ''
              return text.trim().length > 0
            },
            target: 'thinking',
            actions: [
              'setFinalTranscript',
              'submitTranscript',
            ],
          },
          {
            // 2. final 为空，但 completedSentences 或 partial 有内容 → 降级使用已有文本
            guard: ({ context }: any) => {
              return context.completedSentences.length > 0 || !!context.partialTranscript?.trim()
            },
            target: 'thinking',
            actions: [
              'appendPartialToCompleted',
              'submitTranscript',
            ],
          },
          {
            // 3. final 和 partial 都为空 → 才提示未识别
            target: 'idle',
            actions: ['resetSession', 'showEmptyAsrToast'],
          },
        ],
        'llm.started': { target: 'thinking' },
        'interrupt.request': { target: 'idle', actions: 'resetSession' },
        'runtime.error': {
          target: 'error',
          actions: assign({ error: ({ event }: any) => (event as any).error }),
        },
      },
    },
    thinking: {
      entry: assign({
        transcript: () => '',
        partialTranscript: () => '',
        completedSentences: () => [],
        receivedSentenceIds: () => [],
      }),
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
        'tts.complete': {
          // Stream ended, but audio may still be playing in queue.
          // Wait for playback.complete (fired when queue is drained).
          actions: assign({ toastMessage: () => undefined }),
        },
        'playback.complete': {
          // TTS playback fully done → go idle.
          // User must explicitly click record button to start next turn.
          target: 'idle',
        },
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
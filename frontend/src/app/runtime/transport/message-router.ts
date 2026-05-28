import { SERVER_EVENTS } from './protocol'
import type { ServerEventName } from '@livekit-voice/shared/protocol'
import { voiceActor } from '../session'
import { getLogger } from '@livekit-voice/shared/logger'
import { chatStore } from '../../state/chatStore'
import { readAloudStore } from '../../state/readAloudStore'
import { readAloudPlayer } from '../playback/read-aloud-player'
import { ttsPlayback } from '../audio/playback'

const logger = getLogger()

type ServerEventHandler = (event: { type: string; [key: string]: unknown }) => void
type BinaryHandler = (data: ArrayBuffer) => void

let currentAssistantMessageId: string | null = null
let isReadAloudMode = false

export function createMessageRouter(): {
  route: ServerEventHandler
  routeBinary: BinaryHandler
  start: () => void
  stop: () => void
} {
  let isActive = false

  const route: ServerEventHandler = (event) => {
    if (!isActive) return

    const { type, ...payload } = event as { type: string; [key: string]: unknown }

    if (!type) {
      logger.warn('transport.route.missing.type')
      return
    }

    logger.debug('transport.routing.event', { type })

    switch (type as ServerEventName) {
      case SERVER_EVENTS.LLM_STARTED:
        currentAssistantMessageId = null
        const msg = chatStore.addMessage('assistant', '')
        currentAssistantMessageId = msg.id
        chatStore.setStreaming(true)
        voiceActor.send({ type, ...payload } as any)
        break

      case SERVER_EVENTS.LLM_TOKEN:
        if (currentAssistantMessageId) {
          const text = (payload as { token: string }).token
          const state = chatStore.getState()
          const assistantMsg = state.messages.find(m => m.id === currentAssistantMessageId)
          if (assistantMsg) {
            chatStore.updateMessage(currentAssistantMessageId, assistantMsg.content + text)
          }
        }
        voiceActor.send({ type, ...payload } as any)
        break

      case SERVER_EVENTS.LLM_COMPLETE:
        chatStore.setStreaming(false)
        currentAssistantMessageId = null
        voiceActor.send({ type, ...payload } as any)
        break

      case SERVER_EVENTS.SESSION_STARTED:
      case SERVER_EVENTS.SESSION_ERROR:
      case SERVER_EVENTS.STATE_UPDATE:
      case SERVER_EVENTS.ASR_PARTIAL:
      case SERVER_EVENTS.ASR_FINAL:
        chatStore.setStreaming(false)
        voiceActor.send({ type, ...payload } as any)
        break
      case SERVER_EVENTS.INTERRUPT_DETECTED:
        logger.debug('msg_router_removal_event', { type })
        chatStore.setStreaming(false)
        if (currentAssistantMessageId) {
          chatStore.removeMessage(currentAssistantMessageId)
          currentAssistantMessageId = null
        }
        voiceActor.send({ type, ...payload } as any)
        break
      case SERVER_EVENTS.TTS_COMPLETE:
        ttsPlayback.onComplete()
        voiceActor.send({ type, ...payload } as any)
        break
      case SERVER_EVENTS.TTS_STARTED:
      case SERVER_EVENTS.TTS_CHUNK:
      case SERVER_EVENTS.PLAYBACK_START:
      case SERVER_EVENTS.PLAYBACK_CHUNK:
      case SERVER_EVENTS.PLAYBACK_STOP:
      case SERVER_EVENTS.PLAYBACK_UNDERRUN:
        voiceActor.send({ type, ...payload } as any)
        break

      case SERVER_EVENTS.READALOUD_STARTED:
        isReadAloudMode = true
        const readAloudMessageId = (payload as { messageId: string }).messageId
        readAloudStore.setPlaying(readAloudMessageId)
        logger.info('transport.readAloud.started', { messageId: readAloudMessageId })
        break

      case SERVER_EVENTS.READALOUD_COMPLETE:
        isReadAloudMode = false
        readAloudStore.setIdle()
        readAloudPlayer.notifyComplete()
        logger.info('transport.readAloud.complete')
        break

      case SERVER_EVENTS.RUNTIME_ERROR:
      case SERVER_EVENTS.RUNTIME_WARNING:
      case SERVER_EVENTS.DIAGNOSTICS:
        voiceActor.send({ type, ...payload } as any)
        break

      default:
        logger.debug('transport.route.unknown.event', { type })
    }
  }

  const routeBinary: BinaryHandler = (data) => {
    if (!isActive) return

    if (isReadAloudMode) {
      // Route to Read Aloud player
      const pcmData = new Uint8Array(data)
      readAloudPlayer.appendChunk(pcmData)
      logger.debug('transport.binary.readAloud', { size: pcmData.length })
    } else {
      // Route to session TTS playback
      const pcmData = new Uint8Array(data)
      ttsPlayback.onChunk(pcmData)
      logger.debug('transport.binary.sessionTts', { size: pcmData.length })
    }
  }

  const start = () => {
    isActive = true
    logger.info('transport.messageRouter.started')
  }

  const stop = () => {
    isActive = false
    logger.info('transport.messageRouter.stopped')
  }

  return { route, routeBinary, start, stop }
}

export const messageRouter = createMessageRouter()

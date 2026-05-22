import { SERVER_EVENTS } from './protocol'
import type { ServerEventName } from '@livekit-voice/shared/protocol'
import { voiceActor } from '../session'
import { getLogger } from '@livekit-voice/shared/logger'
import { chatStore } from '../../state/chatStore'

const logger = getLogger()

type ServerEventHandler = (event: { type: string; [key: string]: unknown }) => void

let currentAssistantMessageId: string | null = null

export function createMessageRouter(): {
  route: ServerEventHandler
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
      case SERVER_EVENTS.TTS_STARTED:
      case SERVER_EVENTS.TTS_CHUNK:
      case SERVER_EVENTS.TTS_COMPLETE:
      case SERVER_EVENTS.PLAYBACK_START:
      case SERVER_EVENTS.PLAYBACK_CHUNK:
      case SERVER_EVENTS.PLAYBACK_STOP:
      case SERVER_EVENTS.PLAYBACK_UNDERRUN:
        voiceActor.send({ type, ...payload } as any)
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

  const start = () => {
    isActive = true
    logger.info('transport.messageRouter.started')
  }

  const stop = () => {
    isActive = false
    logger.info('transport.messageRouter.stopped')
  }

  return { route, start, stop }
}

export const messageRouter = createMessageRouter()
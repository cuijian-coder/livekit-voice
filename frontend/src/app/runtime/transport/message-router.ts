import { SERVER_EVENTS } from './protocol'
import type { ServerEventName } from '@livekit-voice/shared/protocol'
import { voiceActor } from '../session'
import { getLogger } from '../../core/logger'

const logger = getLogger()

type ServerEventHandler = (event: { type: string; [key: string]: unknown }) => void

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
      case SERVER_EVENTS.SESSION_STARTED:
      case SERVER_EVENTS.SESSION_ERROR:
      case SERVER_EVENTS.STATE_UPDATE:
      case SERVER_EVENTS.ASR_PARTIAL:
      case SERVER_EVENTS.ASR_FINAL:
      case SERVER_EVENTS.LLM_STARTED:
      case SERVER_EVENTS.LLM_TOKEN:
      case SERVER_EVENTS.LLM_COMPLETE:
      case SERVER_EVENTS.TTS_STARTED:
      case SERVER_EVENTS.TTS_CHUNK:
      case SERVER_EVENTS.TTS_COMPLETE:
      case SERVER_EVENTS.PLAYBACK_START:
      case SERVER_EVENTS.PLAYBACK_CHUNK:
      case SERVER_EVENTS.PLAYBACK_STOP:
      case SERVER_EVENTS.PLAYBACK_UNDERRUN:
      case SERVER_EVENTS.INTERRUPT_DETECTED:
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
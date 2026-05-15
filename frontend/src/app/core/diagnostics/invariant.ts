import { getLogger } from '@livekit-voice/shared/logger'

const isDev = import.meta.env.DEV

export function invariant(
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
): asserts condition {
  if (condition) return

  const logger = getLogger()
  logger.error(`[INVARIANT] ${message}`, context)

  if (isDev) {
    throw new Error(`[INVARIANT] ${message}`)
  } else {
    console.warn(`[INVARIANT] ${message}`, context)
  }
}
import { getLogger } from '../../core/logger'

const logger = getLogger()

type ChunkCallback = (text: string) => void
type CompleteCallback = () => void

export interface StreamOptions {
  onChunk: ChunkCallback
  onComplete: CompleteCallback
  delay?: number
  chunkSize?: number
}

let currentController: AbortController | null = null

export function streamText(_text: string, options: StreamOptions): () => void {
  const { onChunk, onComplete, delay = 30, chunkSize = 2 } = options

  currentController = new AbortController()
  const signal = currentController.signal

  let index = 0
  let accumulated = ''

  function processNext(): void {
    if (signal.aborted) return

    const chunk = _text.slice(index, index + chunkSize)
    if (!chunk) {
      logger.debug('stream.complete')
      onComplete()
      currentController = null
      return
    }

    accumulated += chunk
    index += chunkSize
    onChunk(accumulated)

    setTimeout(processNext, delay)
  }

  logger.debug('stream.starting', { textLength: _text.length })
  processNext()

  return () => {
    logger.debug('stream.cancelled')
    currentController?.abort()
    currentController = null
  }
}

export function cancelStream(): void {
  if (currentController) {
    logger.debug('stream.cancel.requested')
    currentController.abort()
    currentController = null
  }
}
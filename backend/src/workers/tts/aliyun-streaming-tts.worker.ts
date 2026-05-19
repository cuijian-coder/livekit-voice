import WebSocket from 'ws'
import { getConfig } from '../../infra/config/config.js'
import type { Logger } from 'pino'

export interface TtsWorker {
  stream(text: string, signal: AbortSignal, logger?: Logger): AsyncIterable<Buffer>
}

function generateUUID(): string {
  let d = Date.now()
  let d2 = (performance && performance.now && performance.now() * 1000) || 0
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    let r = Math.random() * 16
    if (d > 0) {
      r = (d + r) % 16 | 0
      d = Math.floor(d / 16)
    } else {
      r = (d2 + r) % 16 | 0
      d2 = Math.floor(d2 / 16)
    }
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export class AliyunStreamingTtsWorker implements TtsWorker {
  private config = getConfig()

  async *stream(text: string, signal: AbortSignal, logger?: Logger): AsyncIterable<Buffer> {
    const appkey = this.config.NLS_TTS_APPKEY
    const token = this.config.NLS_TTS_TOKEN
    const voice = this.config.NLS_TTS_VOICE || 'xiaoyun'
    const format = this.config.NLS_TTS_FORMAT || 'pcm'
    const sampleRate = this.config.NLS_TTS_SAMPLE_RATE || 16000

    const wsUrl = `wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1?token=${token}`
    const taskId = generateUUID()

    logger?.debug({ wsUrl, voice, format, sampleRate, taskId }, 'aliyun.tts.connecting')

    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'

    let synthesisStarted = false
    let synthesisCompleted = false
    let stopTimeout: ReturnType<typeof setTimeout> | null = null

    const messageQueue: Buffer[] = []
    let messageResolver: ((data: Buffer) => void) | null = null

    const waitForBinary = (): Promise<Buffer> => {
      return new Promise((resolve) => {
        messageResolver = resolve
      })
    }

    const getHeader = (name: string) => ({
      message_id: generateUUID(),
      task_id: taskId,
      namespace: 'FlowingSpeechSynthesizer',
      name,
      appkey,
    })

    const cleanup = () => {
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close()
        }
      } catch { /* ignore close errors */ }
    }

    const parseMessage = (data: unknown): { buffer: Buffer | null; json: object | null } => {
      if (Buffer.isBuffer(data)) {
        try {
          const json = JSON.parse(data.toString('utf-8'))
          return { buffer: null, json }
        } catch {
          return { buffer: data, json: null }
        }
      }
      if (typeof data === 'string') {
        try {
          return { buffer: null, json: JSON.parse(data) }
        } catch {
          return { buffer: null, json: null }
        }
      }
      if (data instanceof ArrayBuffer) {
        const buffer = Buffer.from(data)
        try {
          const json = JSON.parse(buffer.toString('utf-8'))
          return { buffer, json }
        } catch {
          return { buffer, json: null }
        }
      }
      return { buffer: null, json: null }
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('TTS connection timeout (no SynthesisStarted within 10s)'))
        }, 10000)

        ws.on('open', () => {
          logger?.debug({}, 'aliyun.tts.ws_connected')
          const params = {
            header: { ...getHeader('StartSynthesis') },
            payload: {
              voice,
              format,
              sample_rate: sampleRate,
              volume: 50,
              speech_rate: 0,
              pitch_rate: 0,
              enable_subtitle: false,
              platform: 'javascript',
            },
          }
          ws.send(JSON.stringify(params))
        })
        ws.on('error', (err) => {
          logger?.error({ err: err.message }, 'aliyun.tts.ws_error')
          clearTimeout(timeout)
          reject(new Error(`TTS WebSocket error: ${err.message}`))
        })
        ws.on('close', (code, reason) => {
          logger?.debug({ code, reason: reason?.toString() }, 'aliyun.tts.ws_closed')
          if (!synthesisStarted) {
            clearTimeout(timeout)
            reject(new Error(`TTS connection closed before SynthesisStarted: code=${code}, reason=${reason}`))
          }
        })

        ws.on('message', (data) => {
          if (signal.aborted) return

          const { buffer, json } = parseMessage(data)

          if (buffer) {
            logger?.debug({ bufferSize: buffer.length }, 'aliyun.tts.binary_received')
            if (messageResolver) {
              const resolver = messageResolver
              messageResolver = null
              resolver(buffer)
            } else {
              messageQueue.push(buffer)
            }
            return
          }

          if (json && (json as { header?: unknown }).header) {
            const body = json as { header?: { name?: string; status?: number; status_message?: string }; payload?: unknown }
            const eventName = body.header?.name
            const status = body.header?.status

            logger?.debug({ eventName, status }, 'aliyun.tts.message')

            if (eventName === 'SynthesisStarted' && status === 20000000) {
              logger?.debug({}, 'aliyun.tts.synthesis_started')
              synthesisStarted = true
              clearTimeout(timeout)
              resolve()
            } else if (eventName === 'SentenceBegin') {
              logger?.debug({ index: (body.payload as { index?: number })?.index }, 'aliyun.tts.sentence_begin')
            } else if (eventName === 'SentenceEnd') {
              logger?.debug({ text: (body.payload as { subtitles?: { text?: string }[] })?.subtitles?.[0]?.text }, 'aliyun.tts.sentence_end')
            } else if (eventName === 'SynthesisCompleted' && status === 20000000) {
              logger?.debug({}, 'aliyun.tts.synthesis_completed')
              synthesisCompleted = true
            } else if (eventName === 'TaskFailed') {
              logger?.error({ status, message: body.header?.status_message }, 'aliyun.tts.task_failed')
              clearTimeout(timeout)
              reject(new Error(`TTS TaskFailed: ${body.header?.status_message}`))
            }
          }
        })
      })

      if (!synthesisStarted) {
        throw new Error('SynthesisStarted event not received')
      }

      ws.send(JSON.stringify({
        header: { ...getHeader('RunSynthesis') },
        payload: { text },
      }))

      let sentStop = false
      stopTimeout = setTimeout(() => {
        if (!synthesisCompleted && !sentStop) {
          sentStop = true
          ws.send(JSON.stringify({
            header: { ...getHeader('StopSynthesis'), appkey },
          }))
        }
      }, 5000)

      while (!synthesisCompleted && !signal.aborted) {
        let buffer: Buffer

        if (messageQueue.length > 0) {
          buffer = messageQueue.shift()!
        } else {
          try {
            buffer = await Promise.race([
              waitForBinary(),
              new Promise<never>((_, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error('TTS timeout waiting for audio'))
                }, 15000)
                signal.addEventListener('abort', () => clearTimeout(timeout))
              }),
            ])
          } catch (err) {
            if ((err as Error).message === 'aborted' || (err as Error).message === 'TTS timeout waiting for audio') {
              break
            }
            throw err
          }
        }

        yield buffer
      }

      while (messageQueue.length > 0) {
        yield messageQueue.shift()!
      }
    } finally {
      if (stopTimeout) clearTimeout(stopTimeout)
      cleanup()
      logger?.debug({}, 'aliyun.tts.cleanup_done')
    }
  }
}
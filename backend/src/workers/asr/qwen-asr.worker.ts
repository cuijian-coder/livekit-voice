import { WebSocket } from 'ws'
import type { Logger } from 'pino'
import { getConfig } from '../../infra/config/config.js'

export interface AsrResult {
  text: string
  isFinal: boolean
}

export interface AsrWorker {
  stream(audioStream: AsyncIterable<Buffer>, signal: AbortSignal, logger?: Logger): AsyncIterable<AsrResult>
}

export class QwenAsrWorker implements AsrWorker {
  private config = getConfig()
  private wsUrl = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'

  async *stream(audioStream: AsyncIterable<Buffer>, signal: AbortSignal, logger?: Logger): AsyncIterable<AsrResult> {
    let ws: WebSocket | null = null
    let taskStarted = false
    let finished = false
    let resolveNext: (r: AsrResult) => void
    let rejectNext: (e: Error) => void
    let eventQueue: AsrResult[] = []
    let eventReject: ((e: Error) => void) | null = null
    let audioBytesSent = 0

    const nextResult = (): Promise<AsrResult> =>
      new Promise((resolve, reject) => {
        if (eventQueue.length > 0) {
          resolve(eventQueue.shift()!)
        } else {
          resolveNext = resolve
          rejectNext = reject
          eventReject = reject
        }
      })

    const queueResult = (r: AsrResult) => {
      if (resolveNext) {
        resolveNext(r)
        resolveNext = rejectNext = eventReject = undefined as any
      } else {
        eventQueue.push(r)
      }
    }

    const cleanup = () => {
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
      } catch { /* ignore close errors */ }
      ws = null
    }

    try {
      await new Promise<void>((resolve, reject) => {
        ws = new WebSocket(this.wsUrl, {
          headers: {
            Authorization: `Bearer ${this.config.QWEN_API_KEY}`,
          },
        })

        ws.on('open', () => {
          logger?.debug({ url: this.wsUrl }, 'dashscope.asr.connected')
          resolve()
        })
        ws.on('error', (err) => {
          logger?.error({ err: err.message }, 'dashscope.asr.error')
          reject(new Error(`ASR WebSocket error: ${err.message}`))
        })
        ws.on('close', () => {
          if (!finished && !taskStarted) {
            reject(new Error('ASR connection closed before task-started'))
          }
        })

        ws.on('message', (data) => {
          if (signal.aborted) return
          try {
            const msg = JSON.parse(data.toString())
            const event = msg.header?.event

            if (event === 'task-started') {
              taskStarted = true
              logger?.debug({ model: this.config.ASR_MODEL }, 'dashscope.asr.task_started')
              resolve()
            } else if (event === 'result-generated') {
              const sentence = msg.payload?.output?.sentence
              if (!sentence) return
              const text = sentence.text ?? ''
              const isFinal = sentence.sentence_end === true
              if (isFinal) {
                logger?.debug({ text }, 'dashscope.asr.final')
              }
              queueResult({ text, isFinal })
            } else if (event === 'task-finished') {
              finished = true
              logger?.debug({}, 'dashscope.asr.finished')
              if (resolveNext) {
                // Gracefully end the stream with an empty final result
                // This ensures asr.final is always sent to the client,
                // even when ASR produces no recognized text.
                resolveNext({ text: '', isFinal: true })
                resolveNext = rejectNext = eventReject = undefined as any
              }
            } else if (event === 'task-failed') {
              const err = new Error(
                `ASR task failed: ${msg.header?.error_code} ${msg.header?.error_message}`
              )
              logger?.error({ err: err.message }, 'dashscope.asr.failed')
              if (rejectNext) rejectNext(err)
              if (eventReject) eventReject(err)
              cleanup()
            }
          } catch {
          }
        })
      })

      const taskId = crypto.randomUUID().replace(/-/g, '').slice(0, 32)
      ws!.send(
        JSON.stringify({
          header: {
            action: 'run-task',
            task_id: taskId,
            streaming: 'duplex',
          },
          payload: {
            task_group: 'audio',
            task: 'asr',
            function: 'recognition',
            model: 'fun-asr-realtime',
            parameters: {
              format: this.config.ASR_FORMAT,
              sample_rate: this.config.ASR_SAMPLE_RATE,
            },
            input: {},
          },
        })
      )

      const audioSendPromise = (async () => {
        const wsConn = ws!
        let batchBuffer = Buffer.alloc(0)
        const BATCH_SIZE = 3200 // 100ms @ 16kHz 16-bit PCM

        for await (const chunk of audioStream) {
          if (signal.aborted || wsConn.readyState !== WebSocket.OPEN) break

          batchBuffer = Buffer.concat([batchBuffer, chunk])

          // 当累积达到 3200 字节时发送（约 100ms 音频）
          while (batchBuffer.length >= BATCH_SIZE) {
            const toSend = batchBuffer.subarray(0, BATCH_SIZE)
            wsConn.send(toSend, { binary: true })
            audioBytesSent += BATCH_SIZE
            batchBuffer = batchBuffer.subarray(BATCH_SIZE)
          }
        }

        // flush 剩余音频（commit 时 stream 结束触发）
        if (batchBuffer.length > 0 && wsConn.readyState === WebSocket.OPEN) {
          wsConn.send(batchBuffer, { binary: true })
          audioBytesSent += batchBuffer.length
        }

        if (wsConn && wsConn.readyState === WebSocket.OPEN) {
          wsConn.send(
            JSON.stringify({
              header: {
                action: 'finish-task',
                task_id: taskId,
                streaming: 'duplex',
              },
              payload: { input: {} },
            })
          )
          logger?.debug({ bytesSent: audioBytesSent }, 'dashscope.asr.audio_sent')
        }
      })()

      while (!finished && !signal.aborted) {
        try {
          const result = await nextResult()
          if (signal.aborted) break
          yield result
        } catch {
          break
        }
      }

      await audioSendPromise
    } finally {
      try {
        if (signal.aborted) {
          logger?.debug({}, 'dashscope.asr.aborted')
        }
        cleanup()
      } catch { /* prevent cleanup errors from propagating into generator */ }
    }
  }

  async transcribe(audioData: Buffer, signal: AbortSignal, logger?: Logger): Promise<string> {
    const audioStream = (async function* () {
      yield audioData
    })()
    let finalText = ''
    for await (const result of this.stream(audioStream, signal, logger)) {
      if (result.isFinal) finalText = result.text
    }
    return finalText || '[no final result]'
  }
}

export class MockAsrWorker implements AsrWorker {
  async *stream(audioStream: AsyncIterable<Buffer>, signal: AbortSignal, logger?: Logger): AsyncIterable<AsrResult> {
    const chunks: Buffer[] = []
    for await (const chunk of audioStream) {
      if (signal.aborted) return
      chunks.push(chunk)
      yield { text: `[partial ${chunks.length}]`, isFinal: false }
    }
    if (chunks.length > 0) {
      yield { text: '北京的天气', isFinal: true }
    }
  }

  async transcribe(audioData: Buffer, signal: AbortSignal, logger?: Logger): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    if (signal.aborted) throw new Error('aborted')
    return '北京的天气'
  }
}
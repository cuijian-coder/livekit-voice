import { WebSocket } from 'ws'
import { getConfig } from '../../infra/config/config.js'

export interface AsrResult {
  text: string
  isFinal: boolean
}

export interface AsrWorker {
  stream(audioStream: AsyncIterable<Buffer>, signal: AbortSignal): AsyncIterable<AsrResult>
}

export class QwenAsrWorker implements AsrWorker {
  private config = getConfig()
  private wsUrl = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'

  async *stream(audioStream: AsyncIterable<Buffer>, signal: AbortSignal): AsyncIterable<AsrResult> {
    let ws: WebSocket | null = null
    let taskStarted = false
    let finished = false
    let resolveNext: (r: AsrResult) => void
    let rejectNext: (e: Error) => void
    let eventQueue: AsrResult[] = []
    let eventReject: ((e: Error) => void) | null = null

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
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
      ws = null
    }

    try {
      await new Promise<void>((resolve, reject) => {
        ws = new WebSocket(this.wsUrl, {
          headers: {
            Authorization: `Bearer ${this.config.QWEN_API_KEY}`,
          },
        })

        ws.on('open', () => resolve())
        ws.on('error', (err) => reject(new Error(`ASR WebSocket error: ${err.message}`)))
        ws.on('close', () => {
          if (!finished && !taskStarted) {
            reject(new Error('ASR connection closed before task-started'))
          }
        })

        ws.on('message', (data) => {
          if (signal.aborted) return
          const wsConn = ws!
          try {
            const msg = JSON.parse(data.toString())
            const event = msg.header?.event

            if (event === 'task-started') {
              taskStarted = true
              resolve()
            } else if (event === 'result-generated') {
              const sentence = msg.payload?.output?.sentence
              if (!sentence) return
              const text = sentence.text ?? ''
              const isFinal = sentence.sentence_end === true
              queueResult({ text, isFinal })
            } else if (event === 'task-finished') {
              finished = true
              cleanup()
            } else if (event === 'task-failed') {
              const err = new Error(
                `ASR task failed: ${msg.header?.error_code} ${msg.header?.error_message}`
              )
              if (rejectNext) rejectNext(err)
              if (eventReject) eventReject(err)
              cleanup()
            }
          } catch {
            // ignore parse errors
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
            model: this.config.ASR_MODEL,
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
        for await (const chunk of audioStream) {
          if (signal.aborted || wsConn.readyState !== WebSocket.OPEN) break
          wsConn.send(chunk, { binary: true })
          await new Promise((r) => setTimeout(r, 50))
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
      cleanup()
    }
  }

  async transcribe(audioData: Buffer, signal: AbortSignal): Promise<string> {
    const audioStream = (async function* () {
      yield audioData
    })()
    let finalText = ''
    for await (const result of this.stream(audioStream, signal)) {
      if (result.isFinal) finalText = result.text
    }
    return finalText || '[no final result]'
  }
}

export class MockAsrWorker implements AsrWorker {
  async *stream(audioStream: AsyncIterable<Buffer>, signal: AbortSignal): AsyncIterable<AsrResult> {
    const chunks: Buffer[] = []
    for await (const chunk of audioStream) {
      if (signal.aborted) return
      chunks.push(chunk)
      yield { text: `[partial ${chunks.length}]`, isFinal: false }
    }
    if (signal.aborted) return
    const audioData = Buffer.concat(chunks)
    yield { text: `[mock ASR result: ${audioData.length} bytes]`, isFinal: true }
  }

  async transcribe(audioData: Buffer, signal: AbortSignal): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    if (signal.aborted) throw new Error('aborted')
    return `[transcribed: ${audioData.length} bytes]`
  }
}
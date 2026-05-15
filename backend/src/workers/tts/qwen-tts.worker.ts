import { WebSocket } from 'ws'
import { getConfig } from '../../infra/config/config.js'

export interface TtsWorker {
  stream(text: string, signal: AbortSignal): AsyncIterable<Buffer>
}

export class QwenTtsWorker implements TtsWorker {
  private config = getConfig()
  private wsUrl = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'

  async *stream(text: string, signal: AbortSignal): AsyncIterable<Buffer> {
    let ws: WebSocket | null = null
    let taskStarted = false
    let finished = false
    let resolveNext: (r: Buffer) => void
    let rejectNext: (e: Error) => void

    const audioQueue: Buffer[] = []
    let audioReject: ((e: Error) => void) | null = null

    const nextAudio = (): Promise<Buffer> =>
      new Promise((resolve, reject) => {
        if (audioQueue.length > 0) {
          resolve(audioQueue.shift()!)
        } else if (finished) {
          resolve(Buffer.alloc(0))
        } else {
          resolveNext = resolve
          rejectNext = reject
          audioReject = reject
        }
      })

    const queueAudio = (buf: Buffer) => {
      if (buf.length === 0) return
      if (resolveNext) {
        resolveNext(buf)
        resolveNext = rejectNext = audioReject = undefined as any
      } else {
        audioQueue.push(buf)
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
        ws.on('error', (err) => reject(new Error(`TTS WebSocket error: ${err.message}`)))
        ws.on('close', () => {
          if (!finished && !taskStarted) {
            reject(new Error('TTS connection closed before task-started'))
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
              // audio arrives as separate binary frame
            } else if (event === 'task-finished') {
              finished = true
              cleanup()
              if (resolveNext) resolveNext(Buffer.alloc(0))
            } else if (event === 'task-failed') {
              const err = new Error(
                `TTS task failed: ${msg.header?.error_code} ${msg.header?.error_message}`
              )
              if (rejectNext) rejectNext(err)
              if (audioReject) audioReject(err)
              cleanup()
            }
          } catch {
            // ignore parse errors
          }
        })
      })

      const taskId = crypto.randomUUID()
      ws!.send(
        JSON.stringify({
          header: {
            action: 'run-task',
            task_id: taskId,
            streaming: 'duplex',
          },
          payload: {
            task_group: 'audio',
            task: 'tts',
            function: 'SpeechSynthesizer',
            model: this.config.TTS_MODEL,
            parameters: {
              text_type: 'PlainText',
              voice: this.config.TTS_VOICE,
              format: this.config.TTS_FORMAT,
              sample_rate: this.config.TTS_SAMPLE_RATE,
            },
            input: {},
          },
        })
      )

      ws!.send(
        JSON.stringify({
          header: {
            action: 'continue-task',
            task_id: taskId,
            streaming: 'duplex',
          },
          payload: {
            input: { text },
          },
        })
      )

      ws!.send(
        JSON.stringify({
          header: {
            action: 'finish-task',
            task_id: taskId,
            streaming: 'duplex',
          },
          payload: { input: {} },
        })
      )

      while (!finished && !signal.aborted) {
        const buf = await nextAudio()
        if (buf.length === 0) break
        if (signal.aborted) break
        yield buf
      }
    } finally {
      cleanup()
    }
  }

  async *streamFromIterable(textStream: AsyncIterable<string>, signal: AbortSignal): AsyncIterable<Buffer> {
    let ws: WebSocket | null = null
    let taskStarted = false
    let finished = false

    const audioQueue: Buffer[] = []
    let resolveNext: ((r: Buffer) => void) | null = null
    let rejectNext: ((e: Error) => void) | null = null
    let audioReject: ((e: Error) => void) | null = null

    const nextAudio = (): Promise<Buffer> =>
      new Promise((resolve, reject) => {
        if (audioQueue.length > 0) {
          resolve(audioQueue.shift()!)
        } else if (finished) {
          resolve(Buffer.alloc(0))
        } else {
          resolveNext = resolve
          rejectNext = reject
          audioReject = reject
        }
      })

    const queueAudio = (buf: Buffer) => {
      if (buf.length === 0) return
      if (resolveNext) {
        resolveNext(buf)
        resolveNext = rejectNext = audioReject = undefined as any
      } else {
        audioQueue.push(buf)
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
        ws.on('error', (err) => reject(new Error(`TTS WebSocket error: ${err.message}`)))
        ws.on('close', () => {
          if (!finished && !taskStarted) {
            reject(new Error('TTS connection closed before task-started'))
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
            } else if (event === 'task-finished') {
              finished = true
              cleanup()
              if (resolveNext) resolveNext(Buffer.alloc(0))
            } else if (event === 'task-failed') {
              const err = new Error(
                `TTS task failed: ${msg.header?.error_code} ${msg.header?.error_message}`
              )
              if (rejectNext) rejectNext(err)
              if (audioReject) audioReject(err)
              cleanup()
            }
          } catch {
            // ignore parse errors
          }
        })
      })

      const taskId = crypto.randomUUID()
      ws!.send(
        JSON.stringify({
          header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
          payload: {
            task_group: 'audio',
            task: 'tts',
            function: 'SpeechSynthesizer',
            model: this.config.TTS_MODEL,
            parameters: {
              text_type: 'PlainText',
              voice: this.config.TTS_VOICE,
              format: this.config.TTS_FORMAT,
              sample_rate: this.config.TTS_SAMPLE_RATE,
            },
            input: {},
          },
        })
      )

      const sendTask = (async () => {
        const wsConn = ws!
        for await (const text of textStream) {
          if (signal.aborted || wsConn.readyState !== WebSocket.OPEN) break
          if (finished) break
          wsConn.send(
            JSON.stringify({
              header: { action: 'continue-task', task_id: taskId, streaming: 'duplex' },
              payload: { input: { text } },
            })
          )
        }
        if (wsConn && wsConn.readyState === WebSocket.OPEN && !finished) {
          wsConn.send(
            JSON.stringify({
              header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
              payload: { input: {} },
            })
          )
        }
      })()

      while (!finished && !signal.aborted) {
        const buf = await nextAudio()
        if (buf.length === 0) break
        if (signal.aborted) break
        yield buf
      }

      await sendTask
    } finally {
      cleanup()
    }
  }
}

export class MockTtsWorker implements TtsWorker {
  async *stream(text: string, signal: AbortSignal): AsyncIterable<Buffer> {
    await new Promise((resolve) => setTimeout(resolve, 50))
    if (signal.aborted) return
    yield Buffer.from(`[mock TTS audio for: ${text.slice(0, 30)}...]`)
  }
}

export class MockTtsWorker2 implements TtsWorker {
  async *stream(text: string, signal: AbortSignal): AsyncIterable<Buffer> {
    await new Promise((resolve) => setTimeout(resolve, 30))
    if (signal.aborted) return
    yield Buffer.from(`[mock TTS for "${text.slice(0, 20)}"]`)
  }
}
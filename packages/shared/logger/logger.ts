import { RingBuffer } from '../ring-buffer'
import type { LogEvent, LogLevel } from './types'

export class Logger {
  private buffer = new RingBuffer<LogEvent>(200)
  private requestId: string | undefined

  setRequestId(id: string) {
    this.requestId = id
  }

  private log(level: LogLevel, event: string, data?: unknown) {
    const entry: LogEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      event,
      requestId: this.requestId,
      data
    }

    this.buffer.push(entry)

    const json = JSON.stringify(entry)
    if (level === 'error') {
      console.error(json)
    } else {
      console.log(json)
    }
  }

  debug(event: string, data?: unknown) { this.log('debug', event, data) }
  info(event: string, data?: unknown)  { this.log('info', event, data) }
  warn(event: string, data?: unknown) { this.log('warn', event, data) }
  error(event: string, data?: unknown) { this.log('error', event, data) }

  getLogs() { return this.buffer.toArray() }
  clear() { this.buffer.clear() }
}

export const logger = new Logger()
export const getLogger = () => logger
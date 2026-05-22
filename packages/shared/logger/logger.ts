import { RingBuffer } from '../ring-buffer'
import type { LogEvent, LogLevel } from './types'
import { LOG_LEVEL_ORDER } from './types'

export class Logger {
  private buffer = new RingBuffer<LogEvent>(200)
  private requestId: string | undefined
  private minLevel: LogLevel = 'debug'

  setRequestId(id: string) {
    this.requestId = id
  }

  setMinLevel(level: LogLevel) {
    this.minLevel = level
  }

  private shouldLog(level: LogLevel): boolean {
    const minIndex = LOG_LEVEL_ORDER.indexOf(this.minLevel)
    const levelIndex = LOG_LEVEL_ORDER.indexOf(level)
    return levelIndex >= minIndex
  }

  private log(level: LogLevel, event: string, data?: unknown) {
    if (!this.shouldLog(level)) return

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
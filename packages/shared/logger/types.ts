export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export const LOG_LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error']

export interface LogEvent {
  id: string
  timestamp: number
  level: LogLevel
  event: string
  requestId?: string
  data?: unknown
}
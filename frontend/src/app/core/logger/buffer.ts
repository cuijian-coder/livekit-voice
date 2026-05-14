import type { LogEvent } from './types'

const MAX_ENTRIES = 200

export class LogBuffer {
  private entries: LogEvent[] = []

  add(entry: LogEvent) {
    this.entries.push(entry)
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift()
    }
  }

  getAll(): LogEvent[] {
    return [...this.entries]
  }

  clear() {
    this.entries = []
  }
}
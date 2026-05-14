export interface TimelineEvent {
  id: string
  timestamp: number
  event: string
  state?: string
  data?: unknown
}

const MAX_TIMELINE = 100

export class Timeline {
  private events: TimelineEvent[] = []

  add(event: string, data?: unknown) {
    this.events.push({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      event,
      data
    })

    if (this.events.length > MAX_TIMELINE) {
      this.events.shift()
    }
  }

  getRecent(count: number = 20): TimelineEvent[] {
    return this.events.slice(-count)
  }

  clear() {
    this.events = []
  }

  getAll(): TimelineEvent[] {
    return [...this.events]
  }
}

export const timeline = new Timeline()
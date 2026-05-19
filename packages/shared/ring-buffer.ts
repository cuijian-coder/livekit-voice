const DEFAULT_MAX_SIZE = 50

export class RingBuffer<T> {
  private buffer: T[] = []
  private maxSize: number

  constructor(maxSize = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize
  }

  push(item: T): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift()
    }
    this.buffer.push(item)
  }

  toArray(): T[] {
    return [...this.buffer]
  }

  get length(): number {
    return this.buffer.length
  }

  clear(): void {
    this.buffer = []
  }
}
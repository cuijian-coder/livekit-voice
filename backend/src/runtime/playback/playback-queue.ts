export class PlaybackQueue {
  private queue: Buffer[] = []
  private _underrunCount = 0

  enqueue(chunk: Buffer): void {
    this.queue.push(chunk)
  }

  clear(): void {
    this.queue = []
  }

  drain(): Buffer | null {
    const item = this.queue.shift()
    if (!item && this.queue.length === 0) {
      this._underrunCount++
    }
    return item ?? null
  }

  isEmpty(): boolean {
    return this.queue.length === 0
  }

  size(): number {
    return this.queue.length
  }

  get underrunCount(): number {
    return this._underrunCount
  }

  resetUnderrunCount(): void {
    this._underrunCount = 0
  }
}
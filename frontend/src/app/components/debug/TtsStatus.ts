import { createElement } from '../../utils/dom'

export class TtsStatus {
  private element: HTMLElement

  constructor() {
    this.element = createElement('span', 'tts-status')
    this.element.setAttribute('data-testid', 'tts-status')
    this.element.textContent = 'idle'
  }

  setStatus(state: 'idle' | 'playing' | 'error'): void {
    const colorMap: Record<string, string> = {
      idle: '#94a3b8',
      playing: '#22c55e',
      error: '#ef4444'
    }
    const color = colorMap[state] || '#94a3b8'
    this.element.innerHTML = `<span style="color:${color}">●</span> tts:${state}`
  }

  getElement(): HTMLElement {
    return this.element
  }
}
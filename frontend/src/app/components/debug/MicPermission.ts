import { createElement } from '../../utils/dom'

export class MicPermission {
  private element: HTMLElement

  constructor() {
    this.element = createElement('span', 'mic-permission')
    this.element.setAttribute('data-testid', 'mic-permission')
    this.element.textContent = 'unknown'
  }

  setPermission(state: 'granted' | 'denied' | 'prompt' | 'unknown'): void {
    const colorMap: Record<string, string> = {
      granted: '#22c55e',
      denied: '#ef4444',
      prompt: '#eab308',
      unknown: '#94a3b8'
    }
    const color = colorMap[state] || '#94a3b8'
    this.element.innerHTML = `<span style="color:${color}">●</span> ${state}`
  }

  getElement(): HTMLElement {
    return this.element
  }
}
import { createElement } from '../../utils/dom';

export class WsStatus {
  private element: HTMLElement;
  private currentStatus = 'disconnected';

  constructor() {
    this.element = createElement('span', 'ws-status')
    this.element.setAttribute('data-testid', 'ws-status')
    this.render()
  }

  setStatus(status: string): void {
    this.currentStatus = status
    this.render()
  }

  private render(): void {
    const colorMap: Record<string, string> = {
      connected: '#22c55e',
      disconnected: '#94a3b8',
      connecting: '#eab308',
      reconnecting: '#f97316',
      error: '#ef4444'
    }
    const color = colorMap[this.currentStatus] || '#94a3b8'
    this.element.innerHTML = `<span style="color:${color}">●</span> ${this.currentStatus}`
  }

  getElement(): HTMLElement {
    return this.element
  }
}
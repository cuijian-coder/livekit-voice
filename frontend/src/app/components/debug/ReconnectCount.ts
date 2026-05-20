import { createElement } from '../../utils/dom';

export class ReconnectCount {
  private element: HTMLElement;

  constructor() {
    this.element = createElement('span', 'reconnect-count')
    this.element.setAttribute('data-testid', 'reconnect-count')
    this.render(0)
  }

  setCount(count: number): void {
    this.render(count)
  }

  private render(count: number): void {
    this.element.textContent = `reconnect: ${count}`
  }

  getElement(): HTMLElement {
    return this.element
  }
}
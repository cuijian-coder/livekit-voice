import { createElement } from '../utils/dom';

export class TypingIndicator {
  private element: HTMLElement;

  constructor() {
    this.element = createElement('div', 'typing-indicator');
    this.render();
  }

  private render(): void {
    for (let i = 0; i < 3; i++) {
      const dot = createElement('div', 'typing-indicator__dot');
      this.element.appendChild(dot);
    }
  }

  getElement(): HTMLElement {
    return this.element;
  }
}
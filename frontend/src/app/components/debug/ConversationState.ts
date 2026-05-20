import { createElement } from '../../utils/dom';

export class ConversationState {
  private element: HTMLElement;

  constructor() {
    this.element = createElement('span', 'conversation-state')
    this.element.setAttribute('data-testid', 'conversation-state')
    this.render('idle')
  }

  setState(state: string): void {
    this.render(state)
  }

  private render(state: string): void {
    this.element.textContent = state
  }

  getElement(): HTMLElement {
    return this.element
  }
}
import { createElement } from '../utils/dom';
import { formatTime } from '../utils/time';
import type { ChatMessage } from '../types/chat';

export class MessageItem {
  private element: HTMLElement;

  constructor(message: ChatMessage) {
    this.element = createElement('div', `message message--${message.role}`);
    this.render(message);
  }

  private render(message: ChatMessage): void {
    const avatar = createElement('div', 'message__avatar');
    avatar.textContent = message.role === 'user' ? 'U' : 'A';

    const content = createElement('div', 'message__content');
    content.textContent = message.content;

    const wrapper = createElement('div', 'message__wrapper');
    wrapper.appendChild(content);

    const time = createElement('div', 'message__time');
    time.textContent = formatTime(message.createdAt);
    wrapper.appendChild(time);

    this.element.appendChild(avatar);
    this.element.appendChild(wrapper);
  }

  updateContent(content: string): void {
    const contentEl = this.element.querySelector('.message__content');
    if (contentEl) contentEl.textContent = content;
  }

  getElement(): HTMLElement {
    return this.element;
  }
}
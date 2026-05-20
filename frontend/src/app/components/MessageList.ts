import { createElement } from '../utils/dom';
import { chatStore } from '../state/chatStore';
import type { ChatMessage } from '../types/chat';
import { MessageItem } from './MessageItem';
import { TypingIndicator } from './TypingIndicator';

export class MessageList {
  private element: HTMLElement;
  private messageItems: Map<string, MessageItem> = new Map();
  private typingIndicator: TypingIndicator;

  constructor() {
    this.element = createElement('div')
    this.element.setAttribute('data-testid', 'transcript')
    this.typingIndicator = new TypingIndicator();
    this.typingIndicator.getElement().style.display = 'none';
    this.element.appendChild(this.typingIndicator.getElement());

    this.bindEvents();
    this.render();
  }

  private bindEvents(): void {
    chatStore.subscribe((state) => this.update(state.messages));
  }

  private render(): void {
    const state = chatStore.getState();
    this.update(state.messages);
  }

  private update(messages: ChatMessage[]): void {
    const typingEl = this.typingIndicator.getElement();

    const currentIds = new Set(messages.map((m) => m.id));
    for (const [id, item] of this.messageItems) {
      if (!currentIds.has(id)) {
        item.getElement().remove();
        this.messageItems.delete(id);
      }
    }

    messages.forEach((msg) => {
      let item = this.messageItems.get(msg.id);
      if (!item) {
        item = new MessageItem(msg);
        this.element.insertBefore(item.getElement(), typingEl);
        this.messageItems.set(msg.id, item);
      } else {
        const contentEl = item.getElement().querySelector('.message__content');
        if (contentEl && contentEl.textContent !== msg.content) {
          contentEl.textContent = msg.content;
        }
      }
    });

    const state = chatStore.getState();
    typingEl.style.display = state.isStreaming ? 'flex' : 'none';

    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      const parent = this.element.parentElement;
      if (parent) {
        parent.scrollTop = parent.scrollHeight;
      }
    });
  }

  getElement(): HTMLElement {
    return this.element;
  }
}
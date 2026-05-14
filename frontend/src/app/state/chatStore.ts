import type { ChatMessage, ChatState } from '../types/chat';
import { generateId } from '../utils/id';

type Listener = (_state: ChatState) => void;

class ChatStore {
  private state: ChatState = {
    messages: [],
    isStreaming: false,
  };
  private listeners: Listener[] = [];

  getState(): ChatState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.state));
  }

  addMessage(role: 'user' | 'assistant' | 'system', content: string): ChatMessage {
    const message: ChatMessage = {
      id: generateId(),
      role,
      content,
      createdAt: Date.now(),
    };
    this.state.messages.push(message);
    this.notify();
    return message;
  }

  updateMessage(id: string, content: string): void {
    const msg = this.state.messages.find((m) => m.id === id);
    if (msg) {
      msg.content = content;
      this.notify();
    }
  }

  removeMessage(id: string): void {
    this.state.messages = this.state.messages.filter((m) => m.id !== id);
    this.notify();
  }

  clearMessages(): void {
    this.state.messages = [];
    this.notify();
  }

  setStreaming(isStreaming: boolean): void {
    this.state.isStreaming = isStreaming;
    this.notify();
  }
}

export const chatStore = new ChatStore();
import { createElement } from '../utils/dom';
import { formatTime } from '../utils/time';
import type { ChatMessage } from '../types/chat';
import { readAloudStore } from '../state/readAloudStore';
import { readAloudPlayer } from '../runtime/playback/read-aloud-player';
import { wsClient } from '../runtime/transport/websocket-client';
import { voiceActor } from '../voice/providers/voice-provider';

export class MessageItem {
  private element: HTMLElement;
  private messageId: string;
  private role: string;
  private isPlaying = false;

  constructor(message: ChatMessage) {
    this.messageId = message.id;
    this.role = message.role;
    this.element = createElement('div', `message message--${message.role}`);
    this.render(message);

    if (message.role === 'assistant') {
      this.setupActionBar();
      this.subscribeToReadAloud();
    }
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

  private setupActionBar(): void {
    const actionBar = createElement('div', 'message__action-bar');
    
    const readAloudBtn = createElement('button', 'read-aloud-btn');
    readAloudBtn.innerHTML = this.getSpeakerIcon();
    readAloudBtn.title = 'Read aloud';
    readAloudBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleReadAloud();
    });
    
    actionBar.appendChild(readAloudBtn);
    this.element.appendChild(actionBar);

    // Check if session is speaking to disable button
    const snapshot = voiceActor.getSnapshot();
    const isSessionSpeaking = snapshot.value === 'speaking';
    if (isSessionSpeaking) {
      readAloudBtn.disabled = true;
      readAloudBtn.title = 'Assistant speaking...';
    }

    // Subscribe to voice actor state changes
    voiceActor.subscribe((snapshot) => {
      const isSpeaking = snapshot.value === 'speaking';
      readAloudBtn.disabled = isSpeaking;
      readAloudBtn.title = isSpeaking ? 'Assistant speaking...' : 'Read aloud';
    });
  }

  private subscribeToReadAloud(): void {
    readAloudStore.subscribe((state) => {
      const isThisPlaying = state.playingMessageId === this.messageId;
      if (isThisPlaying !== this.isPlaying) {
        this.isPlaying = isThisPlaying;
        this.updateReadAloudIcon();
      }
    });
  }

  private toggleReadAloud(): void {
    if (this.isPlaying) {
      // Stop current playback
      readAloudPlayer.stop();
      readAloudStore.setIdle();
    } else {
      // Stop any existing playback
      const currentPlayingId = readAloudStore.getPlayingMessageId();
      if (currentPlayingId && currentPlayingId !== this.messageId) {
        readAloudPlayer.stop();
      }

      // Start new playback
      const content = this.element.querySelector('.message__content')?.textContent || '';
      readAloudStore.setPlaying(this.messageId);
      readAloudPlayer.init(this.messageId);
      
      // Send request to backend
      wsClient.send({
        type: 'readAloud.start',
        messageId: this.messageId,
        text: content
      } as any);
    }
  }

  private updateReadAloudIcon(): void {
    const btn = this.element.querySelector('.read-aloud-btn') as HTMLButtonElement | null;
    if (!btn) return;
    
    if (this.isPlaying) {
      btn.innerHTML = this.getStopIcon();
      btn.classList.add('read-aloud-btn--playing');
    } else {
      btn.innerHTML = this.getSpeakerIcon();
      btn.classList.remove('read-aloud-btn--playing');
    }
  }

  private getSpeakerIcon(): string {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 5L6 9H2v6h4l5 4V5z"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>`;
  }

  private getStopIcon(): string {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="6" y="6" width="12" height="12"/>
    </svg>`;
  }

  updateContent(content: string): void {
    const contentEl = this.element.querySelector('.message__content');
    if (contentEl) contentEl.textContent = content;
  }

  getElement(): HTMLElement {
    return this.element;
  }
}

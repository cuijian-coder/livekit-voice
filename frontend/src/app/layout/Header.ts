import { createElement } from '../utils/dom';
import { uiStore } from '../state/uiStore';

export class Header {
  private element: HTMLElement;

  constructor() {
    this.element = createElement('header', 'header');
    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="header__left">
        <span class="header__title">Voice Chat</span>
        <span class="header__badge">XState</span>
      </div>
      <div class="header__right">
        <button class="theme-toggle" title="切换主题">
          <span class="theme-toggle__icon">☀️</span>
        </button>
      </div>
    `;
  }

  private bindEvents(): void {
    uiStore.subscribe((state) => this.updateTheme(state.theme));

    const themeBtn = this.element.querySelector('.theme-toggle');
    themeBtn?.addEventListener('click', () => uiStore.toggleTheme());
  }

  private updateTheme(theme: 'light' | 'dark'): void {
    const icon = this.element.querySelector('.theme-toggle__icon');
    if (icon) {
      icon.textContent = theme === 'light' ? '☀️' : '🌙';
    }
  }

  getElement(): HTMLElement {
    return this.element;
  }
}
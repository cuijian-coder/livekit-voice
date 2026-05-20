import { createElement } from '../utils/dom';
import { uiStore } from '../state/uiStore';
import { StatusBar } from '../components/debug';

export class Header {
  private element: HTMLElement;
  private statusBar: StatusBar;

  constructor() {
    this.element = createElement('header', 'header');
    this.statusBar = new StatusBar();
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
        <div class="header__status"></div>
        <button class="theme-toggle" title="切换主题">
          <span class="theme-toggle__icon">☀️</span>
        </button>
      </div>
    `;

    const statusContainer = this.element.querySelector('.header__status')
    if (statusContainer) {
      statusContainer.appendChild(this.statusBar.getElement())
    }
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
import { ChatLayout } from './layout/ChatLayout';
import { uiStore } from './state/uiStore';

export class App {
  private root: HTMLElement;
  private chatLayout: ChatLayout;

  constructor(rootSelector: string) {
    const root = document.querySelector<HTMLElement>(rootSelector);
    if (!root) throw new Error(`Root element ${rootSelector} not found`);
    this.root = root;
    this.chatLayout = new ChatLayout();
    this.initTheme();
    this.mount();
  }

  private initTheme(): void {
    uiStore.subscribe((state) => {
      document.body.setAttribute('data-theme', state.theme);
    });

    const currentTheme = uiStore.getState().theme;
    document.body.setAttribute('data-theme', currentTheme);
  }

  private mount(): void {
    this.root.innerHTML = '';
    this.root.appendChild(this.chatLayout.getElement());
  }
}
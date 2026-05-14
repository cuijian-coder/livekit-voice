type Listener = (_state: UIState) => void;

type Theme = 'light' | 'dark';

interface UIState {
  isInputFocused: boolean;
  isMobile: boolean;
  theme: Theme;
}

class UIStore {
  private state: UIState = {
    isInputFocused: false,
    isMobile: window.innerWidth < 768,
    theme: 'light',
  };
  private listeners: Listener[] = [];

  getState(): UIState {
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

  setInputFocused(focused: boolean): void {
    this.state.isInputFocused = focused;
    this.notify();
  }

  setMobile(isMobile: boolean): void {
    this.state.isMobile = isMobile;
    this.notify();
  }

  setTheme(theme: Theme): void {
    this.state.theme = theme;
    this.notify();
  }

  toggleTheme(): void {
    this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
    this.notify();
  }
}

export const uiStore = new UIStore();
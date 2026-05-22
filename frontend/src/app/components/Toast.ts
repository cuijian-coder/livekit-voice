import { createElement } from '../utils/dom'

let toastInstance: Toast | null = null

export class Toast {
  private container: HTMLElement
  private currentEl: HTMLElement | null = null
  private hideTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.container = createElement('div', 'toast-container')
    document.body.appendChild(this.container)
  }

  static getInstance(): Toast {
    if (!toastInstance) {
      toastInstance = new Toast()
    }
    return toastInstance
  }

  show(message: string, duration = 2000): void {
    // Clear previous toast if any
    this.hideImmediate()

    this.currentEl = createElement('div', 'toast toast--visible')
    this.currentEl.textContent = message
    this.currentEl.setAttribute('role', 'alert')
    this.container.appendChild(this.currentEl)

    // Force reflow for transition
    void this.currentEl.offsetHeight

    this.hideTimer = setTimeout(() => {
      this.hide()
    }, duration)
  }

  hide(): void {
    if (!this.currentEl) return
    this.currentEl.classList.remove('toast--visible')
    this.currentEl.addEventListener('transitionend', () => {
      this.hideImmediate()
    }, { once: true })
  }

  private hideImmediate(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    }
    if (this.currentEl) {
      this.currentEl.remove()
      this.currentEl = null
    }
  }
}

export const toast = Toast.getInstance()

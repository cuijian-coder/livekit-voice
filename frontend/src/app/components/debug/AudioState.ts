import { createElement } from '../../utils/dom';

export class AudioState {
  private element: HTMLElement;

  constructor() {
    this.element = createElement('span', 'audio-state')
    this.element.setAttribute('data-testid', 'audio-state')
    this.render('idle')
  }

  setState(machineState: string): void {
    let audioState = 'idle'
    if (machineState === 'listening') {
      audioState = 'recording'
    } else if (machineState === 'speaking') {
      audioState = 'playing'
    }
    this.render(audioState)
  }

  private render(state: string): void {
    this.element.textContent = state
  }

  getElement(): HTMLElement {
    return this.element
  }
}
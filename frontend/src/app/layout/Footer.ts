export class Footer {
  private element: HTMLElement;

  constructor() {
    this.element = document.createElement('footer');
    this.element.style.display = 'none';
  }

  getElement(): HTMLElement {
    return this.element;
  }
}
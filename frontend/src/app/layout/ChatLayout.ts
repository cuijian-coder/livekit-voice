import { createElement } from '../utils/dom';
import { Header } from './Header';
import { MessageList } from '../components/MessageList';
import { InputBar } from '../components/InputBar';

export class ChatLayout {
  private element: HTMLElement;
  private header: Header;
  private messageList: MessageList;
  private inputBar: InputBar;

  constructor() {
    this.element = createElement('div', 'chat-layout');

    this.header = new Header();
    this.messageList = new MessageList();
    this.inputBar = new InputBar();

    this.render();
  }

  private render(): void {
    const messageArea = createElement('div', 'message-area');
    const inputArea = createElement('div', 'input-area');

    messageArea.appendChild(this.messageList.getElement());
    inputArea.appendChild(this.inputBar.getElement());

    this.element.appendChild(this.header.getElement());
    this.element.appendChild(messageArea);
    this.element.appendChild(inputArea);
  }

  getElement(): HTMLElement {
    return this.element;
  }
}
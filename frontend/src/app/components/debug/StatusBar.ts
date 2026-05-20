import { createElement } from '../../utils/dom'
import { voiceActor } from '../../voice/providers/voice-provider'
import { wsClient } from '../../runtime/transport/websocket-client'
import { WsStatus } from './WsStatus'
import { ConversationState } from './ConversationState'
import { AudioState } from './AudioState'
import { ReconnectCount } from './ReconnectCount'

export class StatusBar {
  private element: HTMLElement
  private wsStatus: WsStatus
  private conversationState: ConversationState
  private audioState: AudioState
  private reconnectCount: ReconnectCount

  constructor() {
    this.element = createElement('div', 'status-bar')

    this.wsStatus = new WsStatus()
    this.conversationState = new ConversationState()
    this.audioState = new AudioState()
    this.reconnectCount = new ReconnectCount()

    this.bindVoiceActor()
    this.bindWsClient()
    this.render()
  }

  private bindVoiceActor(): void {
    voiceActor.subscribe((snapshot) => {
      const state = snapshot.value as string
      this.conversationState.setState(state)
      this.audioState.setState(state)
    })
  }

  private bindWsClient(): void {
    wsClient.onStateChange((state) => {
      this.wsStatus.setStatus(state.state)
      this.reconnectCount.setCount(state.reconnectAttempt || 0)
    })

    const initialState = wsClient.getState()
    this.wsStatus.setStatus(initialState.state)
    this.reconnectCount.setCount(initialState.reconnectAttempt || 0)
  }

  private render(): void {
    const container = createElement('div', 'status-bar__container')

    const divider = (): HTMLElement => {
      const el = document.createElement('span')
      el.className = 'status-divider'
      el.textContent = '|'
      return el
    }

    container.appendChild(this.wsStatus.getElement())
    container.appendChild(divider())
    container.appendChild(this.conversationState.getElement())
    container.appendChild(divider())
    container.appendChild(this.audioState.getElement())
    container.appendChild(divider())
    container.appendChild(this.reconnectCount.getElement())

    this.element.appendChild(container)
  }

  getElement(): HTMLElement {
    return this.element
  }
}
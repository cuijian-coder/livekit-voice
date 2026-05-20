import { createElement } from '../utils/dom';
import { chatStore } from '../state/chatStore';
import { voiceActor } from '../voice/providers/voice-provider';
import { selectActionButton } from '../voice/selectors/actionButton.selector';
import { getButtonConfig } from '../voice/ui/button-config';
import { audioRecorder } from '../runtime/audio/recorder';

export class InputBar {
  private element: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private actionButton: HTMLButtonElement;
  private isProcessing = false;

  constructor() {
    this.element = createElement('div', 'input-bar');
    this.textarea = document.createElement('textarea');
    this.actionButton = document.createElement('button');
    this.render();
    this.bindEvents();
    this.updateButton();
  }

  private render(): void {
    const wrapper = createElement('div', 'input-bar__wrapper');

    this.textarea.className = 'input-bar__textarea'
    this.textarea.placeholder = '发消息...'
    this.textarea.rows = 1
    this.textarea.setAttribute('data-testid', 'text-input')

    this.actionButton.className = 'input-bar__action-button--mic'
    this.actionButton.setAttribute('data-testid', 'push-to-talk')

    wrapper.appendChild(this.textarea)

    this.element.appendChild(wrapper)
    this.element.appendChild(this.actionButton)
  }

  private bindEvents(): void {
    this.textarea.addEventListener('input', () => {
      this.handleInput();
      this.updateButton();
    });

    this.textarea.addEventListener('keydown', (e) => this.handleKeydown(e));

    this.actionButton.addEventListener('click', () => this.handleButtonClick());

    voiceActor.subscribe(() => {
      this.onStateChange();
      this.updateButton();
    });
  }

  private onStateChange(): void {
    const snapshot = voiceActor.getSnapshot()
    const state = snapshot.value as string
    const isRecording = state === 'listening'
    const isTranscribing = state === 'transcribing'

    console.log('[InputBar] onStateChange:', state, 'isRecording:', isRecording)

    if (isRecording) {
      console.log('[InputBar] Setting audio level callback')
      audioRecorder.setAudioLevelCallback((level) => {
        console.log('[InputBar] Audio level:', level)
        this.updateRecordingVisualization(level)
      })
    }

    // 显示实时 ASR 部分结果
    if (isTranscribing) {
      const partialTranscript = snapshot.context.partialTranscript
      if (partialTranscript) {
        this.textarea.value = partialTranscript
      }
    }
  }

  private updateRecordingVisualization(level: number): void {
    // 根据音量动态调整4个点的高度，模拟波浪摆动
    const svg = this.actionButton.querySelector('.sound-wave-icon') as SVGSVGElement | null
    if (!svg) return

    const bars = svg.querySelectorAll('rect')
    if (bars.length !== 4) return

    const minHeight = 4   // 最小高度（4个点）
    const maxHeight = 16  // 最大高度
    
    // level=0 表示无人声，显示4个水平点
    if (level === 0) {
      bars.forEach((bar) => {
        if (bar instanceof SVGRectElement) {
          bar.setAttribute('height', String(minHeight))
          bar.setAttribute('y', String((20 - minHeight) / 2))
        }
      })
      return
    }
    
    // 有声音，使用正弦波产生波浪效果
    const normalized = level / 100
    
    // 四个点的相位偏移，产生波浪摆动效果
    const phases = [0, 0.25, 0.5, 0.75]
    
    const heights = phases.map(phase => {
      // 正弦波计算：基础值 + 波动
      const wave = Math.sin(normalized * Math.PI * 2 + phase * Math.PI * 2)
      // 最小 0.2，最大 1.0（基于音量）
      const amplitude = 0.2 + normalized * 0.8
      const height = minHeight + (maxHeight - minHeight) * amplitude * (0.5 + wave * 0.5)
      return Math.round(height)
    })

    bars.forEach((bar, i) => {
      if (bar instanceof SVGRectElement) {
        const h = Math.max(minHeight, Math.min(maxHeight, heights[i]))
        bar.setAttribute('height', String(h))
        bar.setAttribute('y', String((20 - h) / 2))
      }
    })
  }

  private handleInput(): void {
    this.textarea.style.height = 'auto';
    this.textarea.style.height = `${Math.min(this.textarea.scrollHeight, 100)}px`;
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  private handleButtonClick(): void {
    const hasInput = this.textarea.value.trim().length > 0;
    const snapshot = voiceActor.getSnapshot();
    const buttonVm = selectActionButton(snapshot, hasInput);

    if (buttonVm.semantic === 'send') {
      this.sendMessage();
    } else if (buttonVm.semantic === 'record') {
      voiceActor.send({ type: 'session.start' });
    } else if (buttonVm.semantic === 'stop-recording') {
      voiceActor.send({ type: 'audio.commit' });
    } else if (buttonVm.semantic === 'interrupt') {
      voiceActor.send({ type: 'interrupt.request' });
    }
  }

  private updateButton(): void {
    const hasInput = this.textarea.value.trim().length > 0;
    const snapshot = voiceActor.getSnapshot();
    const buttonVm = selectActionButton(snapshot, hasInput);
    const config = getButtonConfig(buttonVm.semantic);

    this.actionButton.className = config.className;
    this.actionButton.innerHTML = config.icon;
    this.actionButton.disabled = buttonVm.disabled;
  }

  private async sendMessage(): Promise<void> {
    const content = this.textarea.value.trim();
    if (!content || this.isProcessing) return;

    this.isProcessing = true;
    this.textarea.value = '';
    this.textarea.style.height = 'auto';

    chatStore.addMessage('user', content);

    voiceActor.send({ type: 'SUBMIT_TEXT', text: content });

    this.isProcessing = false;
  }

  getElement(): HTMLElement {
    return this.element;
  }
}
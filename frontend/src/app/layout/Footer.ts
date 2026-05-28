import { createElement } from '../utils/dom';
import { componentRegistry } from '../runtime/component-registry';

/**
 * Footer component.
 *
 * Provides a status slot that external modules can activate via showAgentStatus().
 * When no agent is registered, the slot is hidden and the footer appears blank.
 */
export class Footer {
  private element: HTMLElement;
  private statusIndicator: HTMLElement;

  constructor() {
    this.element = document.createElement('footer');
    this.element.className = 'footer';
    this.element.style.display = 'flex';
    this.element.style.justifyContent = 'flex-end';
    this.element.style.alignItems = 'center';
    this.element.style.padding = '8px 16px';
    this.element.style.gap = '12px';

    this.statusIndicator = createElement('div', 'footer__agent-status');
    this.statusIndicator.style.display = 'none'; // 默认隐藏
    this.statusIndicator.style.alignItems = 'center';
    this.statusIndicator.style.gap = '6px';
    this.statusIndicator.style.fontSize = '12px';
    this.statusIndicator.style.color = 'var(--text-secondary, #888)';

    this.element.appendChild(this.statusIndicator);

    // 自注册到全局组件注册表，供外部模块反向发现
    componentRegistry.register('footer', this);
  }

  /**
   * 激活 Agent 状态显示区域，返回 DOM 元素供外部绑定状态更新。
   */
  showAgentStatus(): HTMLElement {
    this.statusIndicator.style.display = 'flex';
    return this.statusIndicator;
  }

  getElement(): HTMLElement {
    return this.element;
  }
}

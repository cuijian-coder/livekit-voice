import type { ButtonSemantic } from '../selectors/actionButton.selector';
import * as icons from './icons';

export interface ButtonConfig {
  icon: string;
  className: string;
}

export const BUTTON_CONFIGS: Record<ButtonSemantic, ButtonConfig> = {
  record: {
    icon: icons.micIcon,
    className: 'input-bar__action-button--mic',
  },
  'stop-recording': {
    icon: icons.micRecordingIcon,
    className: 'input-bar__action-button--recording',
  },
  interrupt: {
    icon: icons.stopIcon,
    className: 'input-bar__action-button--interrupt',
  },
  send: {
    icon: icons.sendIcon,
    className: 'input-bar__action-button send',
  },
  loading: {
    icon: icons.thinkingIcon,
    className: 'input-bar__action-button--thinking',
  },
  disabled: {
    icon: icons.errorIcon,
    className: 'input-bar__action-button--disabled',
  },
};

export function getButtonConfig(semantic: ButtonSemantic): ButtonConfig {
  return BUTTON_CONFIGS[semantic];
}
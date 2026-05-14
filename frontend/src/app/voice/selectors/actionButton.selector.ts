export type ButtonSemantic =
  | 'record'
  | 'stop-recording'
  | 'interrupt'
  | 'send'
  | 'loading'
  | 'disabled';

export interface ButtonViewModel {
  semantic: ButtonSemantic;
  label: string;
  className: string;
  pulse: boolean;
  disabled: boolean;
}

const BUTTON_LABELS: Record<ButtonSemantic, string> = {
  record: '开始录音',
  'stop-recording': '停止录音',
  interrupt: '点击中断',
  send: '发送消息',
  loading: '思考中...',
  disabled: '请稍候',
};

const BUTTON_CLASSES: Record<ButtonSemantic, string> = {
  record: 'input-bar__action-button--mic',
  'stop-recording': 'input-bar__action-button--mic-recording',
  interrupt: 'input-bar__action-button--interrupt',
  send: 'input-bar__action-button send',
  loading: 'input-bar__action-button--thinking',
  disabled: 'input-bar__action-button--disabled',
};

export function selectActionButton(
  snapshot: any,
  hasInput: boolean
): ButtonViewModel {
  const state = snapshot.value as string;
  const hasError = snapshot.context.error !== undefined;
  const isProcessing = state === 'thinking' || state === 'streaming';

  if (hasError) {
    return {
      semantic: 'disabled',
      label: BUTTON_LABELS.disabled,
      className: BUTTON_CLASSES.disabled,
      pulse: false,
      disabled: true,
    };
  }

  if (hasInput) {
    return {
      semantic: 'send',
      label: BUTTON_LABELS.send,
      className: BUTTON_CLASSES.send,
      pulse: false,
      disabled: isProcessing,
    };
  }

  if (state === 'listening') {
    return {
      semantic: 'stop-recording',
      label: BUTTON_LABELS['stop-recording'],
      className: BUTTON_CLASSES['stop-recording'],
      pulse: true,
      disabled: false,
    };
  }

  if (state === 'thinking' || state === 'streaming') {
    return {
      semantic: 'interrupt',
      label: BUTTON_LABELS.interrupt,
      className: BUTTON_CLASSES.interrupt,
      pulse: false,
      disabled: false,
    };
  }

  if (state === 'playing') {
    return {
      semantic: 'interrupt',
      label: BUTTON_LABELS.interrupt,
      className: BUTTON_CLASSES.interrupt,
      pulse: false,
      disabled: false,
    };
  }

  return {
    semantic: 'record',
    label: BUTTON_LABELS.record,
    className: BUTTON_CLASSES.record,
    pulse: false,
    disabled: false,
  };
}
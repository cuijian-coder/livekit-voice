export interface VoiceStatusViewModel {
  text: string;
  icon: string;
  color: string;
}

export function selectVoiceStatus(
  snapshot: any
): VoiceStatusViewModel {
  const state = snapshot.value as string;

  if (snapshot.context.error) {
    return {
      text: '错误: ' + snapshot.context.error,
      icon: '⚠️',
      color: '#ef4444',
    };
  }

  if (state === 'listening') {
    return {
      text: '录音中...',
      icon: '🎤',
      color: '#ef4444',
    };
  }

  if (state === 'playing') {
    return {
      text: '播放中...',
      icon: '🔊',
      color: '#10a37f',
    };
  }

  if (state === 'thinking') {
    return {
      text: '思考中...',
      icon: '💭',
      color: '#10a37f',
    };
  }

  if (state === 'streaming') {
    return {
      text: '生成中...',
      icon: '✨',
      color: '#10a37f',
    };
  }

  return {
    text: '就绪',
    icon: '✅',
    color: '#8e8e8e',
  };
}
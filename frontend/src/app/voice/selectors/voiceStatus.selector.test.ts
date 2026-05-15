import { describe, it, expect } from 'vitest'
import { selectVoiceStatus } from './voiceStatus.selector'

const createSnapshot = (state: string, error?: string) => ({
  value: state,
  context: {
    requestId: 'req-123',
    transcript: '',
    partialTranscript: '',
    streamBuffer: '',
    sessionId: 'sess-1',
    turnId: '',
    abortController: undefined,
    error: error,
  },
})

describe('selectVoiceStatus', () => {
  it('should return ready for idle state', () => {
    const snapshot = createSnapshot('idle')
    const result = selectVoiceStatus(snapshot)
    expect(result.text).toBe('就绪')
    expect(result.icon).toBe('✅')
  })

  it('should return recording for listening state', () => {
    const snapshot = createSnapshot('listening')
    const result = selectVoiceStatus(snapshot)
    expect(result.text).toBe('录音中...')
    expect(result.icon).toBe('🎤')
    expect(result.color).toBe('#ef4444')
  })

  it('should return thinking for thinking state', () => {
    const snapshot = createSnapshot('thinking')
    const result = selectVoiceStatus(snapshot)
    expect(result.text).toBe('思考中...')
    expect(result.icon).toBe('💭')
    expect(result.color).toBe('#10a37f')
  })

  it('should return generating for speaking state', () => {
    const snapshot = createSnapshot('speaking')
    const result = selectVoiceStatus(snapshot)
    expect(result.text).toBe('播放中...')
    expect(result.icon).toBe('🔊')
    expect(result.color).toBe('#10a37f')
  })

  it('should return transcribing for transcribing state', () => {
    const snapshot = createSnapshot('transcribing')
    const result = selectVoiceStatus(snapshot)
    expect(result.text).toBe('识别中...')
    expect(result.icon).toBe('✍️')
    expect(result.color).toBe('#10a37f')
  })

  it('should return error when error exists', () => {
    const snapshot = createSnapshot('idle', 'Some error')
    const result = selectVoiceStatus(snapshot)
    expect(result.text).toContain('错误')
    expect(result.icon).toBe('⚠️')
    expect(result.color).toBe('#ef4444')
  })
})
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ── Hoisted mocks (run before vi.mock hoisting) ────────────────────────────
const { mockVoiceActor, mockAudioRecorder, mockTextarea, mockButton } = vi.hoisted(() => {
  // Use a mutable store so getSnapshot can return the "current" snapshot
  const state = {
    _lastSnapshot: null as any,
    _subscribeCb: null as any,
  }
  const mockVoiceActor = {
    subscribe: vi.fn((cb: any) => { state._subscribeCb = cb }),
    getSnapshot: vi.fn(() => state._lastSnapshot),
    send: vi.fn(),
    _state: state,
  }
  const mockAudioRecorder = {
    setAudioLevelCallback: vi.fn(),
  }
  const mockTextarea = {
    _value: '',
    get value() { return this._value },
    set value(v: string) { this._value = v },
    className: 'input-bar__textarea',
    placeholder: '',
    rows: 1,
    getAttribute: vi.fn((name: string) => name === 'data-testid' ? 'text-input' : null),
    setAttribute: vi.fn(),
    addEventListener: vi.fn(),
    style: {},
  }
  const mockButton = {
    _className: '',
    get className() { return this._className },
    set className(v: string) { this._className = v },
    _disabled: false,
    get disabled() { return this._disabled },
    set disabled(v: boolean) { this._disabled = v },
    getAttribute: vi.fn((name: string) => name === 'data-testid' ? 'push-to-talk' : null),
    setAttribute: vi.fn(),
    addEventListener: vi.fn(),
    querySelector: vi.fn().mockReturnValue(null),
    innerHTML: '',
  }
  return { mockVoiceActor, mockAudioRecorder, mockTextarea, mockButton }
})

// ── Module mocks (use hoisted variables) ───────────────────────────────────
vi.mock('../voice/providers/voice-provider', () => ({
  voiceActor: mockVoiceActor,
}))

vi.mock('../runtime/audio/recorder', () => ({
  audioRecorder: mockAudioRecorder,
}))

vi.mock('../state/chatStore', () => ({
  chatStore: {
    addMessage: vi.fn(),
    setStreaming: vi.fn(),
    getState: vi.fn().mockReturnValue({ messages: [] }),
    updateMessage: vi.fn(),
  },
}))

vi.mock('../voice/selectors/actionButton.selector', () => ({
  selectActionButton: vi.fn().mockReturnValue({ semantic: 'record', disabled: false }),
}))

vi.mock('../voice/ui/button-config', () => ({
  getButtonConfig: vi.fn().mockReturnValue({ className: 'btn', icon: '<svg/>' }),
}))

const mockWrapper = { appendChild: vi.fn() } as any
const mockElement = { appendChild: vi.fn() } as any

vi.mock('../utils/dom', () => ({
  createElement: vi.fn((tag: string, className?: string) => {
    if (className === 'input-bar__wrapper') return mockWrapper
    if (tag === 'textarea') return mockTextarea
    if (tag === 'button') return mockButton
    return mockElement
  }),
}))

// ── Tests ──────────────────────────────────────────────────────────────────
import { InputBar } from './InputBar'

describe('InputBar', () => {
  let originalDocument: any

  function setSnapshot(snapshot: any) {
    mockVoiceActor._state._lastSnapshot = snapshot
  }

  function triggerSubscribe(snapshot: any) {
    setSnapshot(snapshot)
    const cb = mockVoiceActor._state._subscribeCb
    if (cb) cb(snapshot)
  }

  beforeEach(() => {
    mockTextarea._value = ''
    mockButton._className = ''
    mockButton._disabled = false
    mockVoiceActor._state._lastSnapshot = null
    mockVoiceActor._state._subscribeCb = null
    vi.clearAllMocks()

    // Stub document.createElement for node environment
    originalDocument = (globalThis as any).document
    ;(globalThis as any).document = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'textarea') return mockTextarea
        if (tag === 'button') return mockButton
        return mockElement
      }),
      querySelector: vi.fn().mockReturnValue(mockElement),
    }
  })

  afterEach(() => {
    ;(globalThis as any).document = originalDocument
    vi.restoreAllMocks()
  })

  function makeSnapshot(state: string, partialTranscript = '', transcript = '') {
    return {
      value: state,
      context: {
        partialTranscript,
        transcript,
        turnId: 'test-turn',
      },
    }
  }

  it('should display partial transcript in listening state', () => {
    setSnapshot(makeSnapshot('listening', '你好', ''))
    new InputBar()
    expect(mockVoiceActor._state._subscribeCb).not.toBeNull()

    triggerSubscribe(makeSnapshot('listening', '你好世界', ''))

    expect(mockTextarea.value).toBe('你好世界')
  })

  it('should display partial transcript in transcribing state', () => {
    setSnapshot(makeSnapshot('transcribing', '正在转写', ''))
    new InputBar()

    triggerSubscribe(makeSnapshot('transcribing', '正在转写中', ''))

    expect(mockTextarea.value).toBe('正在转写中')
  })

  it('should display partial transcript in thinking state', () => {
    setSnapshot(makeSnapshot('thinking', '思考中', ''))
    new InputBar()

    triggerSubscribe(makeSnapshot('thinking', '思考结果', ''))

    expect(mockTextarea.value).toBe('思考结果')
  })

  it('should display final transcript in idle state', () => {
    setSnapshot(makeSnapshot('idle', '', '最终结果'))
    new InputBar()

    triggerSubscribe(makeSnapshot('idle', '', '最终结果'))

    expect(mockTextarea.value).toBe('最终结果')
  })

  it('should display final transcript in listening state when there is a final result', () => {
    setSnapshot(makeSnapshot('listening', '', '已确认'))
    new InputBar()

    triggerSubscribe(makeSnapshot('listening', '', '已确认'))

    expect(mockTextarea.value).toBe('已确认')
  })

  it('should not overwrite textarea in speaking state', () => {
    setSnapshot(makeSnapshot('speaking', '', ''))
    new InputBar()
    mockTextarea._value = 'user typed'

    triggerSubscribe(makeSnapshot('speaking', '', ''))

    expect(mockTextarea.value).toBe('user typed')
  })

  it('should show final over partial in listening when both exist (current behavior)', () => {
    setSnapshot(makeSnapshot('listening', 'partial', 'final'))
    new InputBar()

    triggerSubscribe(makeSnapshot('listening', 'partial', 'final'))

    // Note: final transcript overwrites partial in listening state.
    // This preserves legacy behavior; changing it is a separate UX decision.
    expect(mockTextarea.value).toBe('final')
  })
})

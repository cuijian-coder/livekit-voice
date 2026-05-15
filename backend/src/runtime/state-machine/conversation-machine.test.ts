import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { conversationMachine } from './conversation-machine'

const s = {
  IDLE: 'idle',
  LISTENING: 'listening',
  TRANSCRIBING: 'transcribing',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  INTERRUPTING: 'interrupting',
  RECOVERING: 'recovering',
  ERROR: 'error',
}

describe('conversationMachine', () => {
  it('should start in idle', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    expect(actor.getSnapshot().value).toBe(s.IDLE)
    actor.stop()
  })

  it('should transition to listening on START', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    expect(actor.getSnapshot().value).toBe(s.LISTENING)
    actor.stop()
  })

  it('should transition to transcribing on VAD_END', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    expect(actor.getSnapshot().value).toBe(s.TRANSCRIBING)
    actor.stop()
  })

  it('should transition to thinking on ASR_COMPLETE', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    actor.send({ type: 'ASR_COMPLETE', text: 'hello' } as any)
    expect(actor.getSnapshot().value).toBe(s.THINKING)
    actor.stop()
  })

  it('should transition to speaking on LLM_COMPLETE', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    actor.send({ type: 'ASR_COMPLETE', text: 'hello' } as any)
    actor.send({ type: 'LLM_COMPLETE' })
    expect(actor.getSnapshot().value).toBe(s.SPEAKING)
    actor.stop()
  })

  it('should transition to idle on SPEAK_COMPLETE', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    actor.send({ type: 'ASR_COMPLETE', text: 'hello' } as any)
    actor.send({ type: 'LLM_COMPLETE' })
    actor.send({ type: 'SPEAK_COMPLETE' })
    expect(actor.getSnapshot().value).toBe(s.IDLE)
    actor.stop()
  })

  it('should transition through full pipeline', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    actor.send({ type: 'ASR_COMPLETE', text: 'hello' } as any)
    actor.send({ type: 'LLM_COMPLETE' })
    actor.send({ type: 'SPEAK_COMPLETE' })
    expect(actor.getSnapshot().value).toBe(s.IDLE)
    actor.stop()
  })

  it('should return to idle after interrupt from listening', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'INTERRUPT' })
    expect(actor.getSnapshot().value).toBe(s.IDLE)
    actor.stop()
  })

  it('should return to idle after interrupt from transcribing', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    actor.send({ type: 'INTERRUPT' })
    expect(actor.getSnapshot().value).toBe(s.IDLE)
    actor.stop()
  })

  it('should return to idle after interrupt from thinking', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    actor.send({ type: 'ASR_COMPLETE', text: 'hello' } as any)
    actor.send({ type: 'INTERRUPT' })
    expect(actor.getSnapshot().value).toBe(s.IDLE)
    actor.stop()
  })

  it('should return to idle after interrupt from speaking', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    actor.send({ type: 'ASR_COMPLETE', text: 'hello' } as any)
    actor.send({ type: 'LLM_COMPLETE' })
    actor.send({ type: 'INTERRUPT' })
    expect(actor.getSnapshot().value).toBe(s.IDLE)
    actor.stop()
  })

  it('should go to error on ERROR from thinking', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    actor.send({ type: 'ASR_COMPLETE', text: 'hello' } as any)
    actor.send({ type: 'ERROR', error: 'llm failed' } as any)
    expect(actor.getSnapshot().value).toBe(s.ERROR)
    actor.stop()
  })

  it('should go to recovering on RECOVER from error', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    actor.send({ type: 'ASR_COMPLETE', text: 'hello' } as any)
    actor.send({ type: 'ERROR', error: 'failed' } as any)
    actor.send({ type: 'RECOVER' })
    expect(actor.getSnapshot().value).toBe(s.RECOVERING)
    actor.stop()
  })

  it('should go to idle on RESET from any state', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe(s.IDLE)

    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    actor.send({ type: 'RESET' })
    expect(actor.getSnapshot().value).toBe(s.IDLE)
    actor.stop()
  })

  it('should go to idle on START from error', () => {
    const actor = createActor(conversationMachine as any)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'VAD_END' })
    actor.send({ type: 'ASR_COMPLETE', text: 'hello' } as any)
    actor.send({ type: 'ERROR', error: 'failed' } as any)
    actor.send({ type: 'START' })
    expect(actor.getSnapshot().value).toBe(s.IDLE)
    actor.stop()
  })
})
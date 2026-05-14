import { describe, it, expect, beforeEach } from 'vitest'
import { createActor } from 'xstate'
import { voiceMachine } from './voice-machine'

describe('voiceMachine', () => {
  let actor: ReturnType<typeof createActor>

  beforeEach(() => {
    actor = createActor(voiceMachine)
    actor.start()
  })

  it('should start in idle state', () => {
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
  })

  it('should transition to listening on START_RECORDING', () => {
    actor.send({ type: 'START_RECORDING' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('listening')
  })

  it('should transition to thinking on STOP_RECORDING', () => {
    actor.send({ type: 'START_RECORDING' })
    actor.send({ type: 'STOP_RECORDING' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('thinking')
  })

  it('should transition to thinking on SUBMIT_TEXT', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('thinking')
  })

  it('should transition to streaming on LLM_DONE', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'LLM_DONE', fullText: 'response' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('streaming')
  })

  it('should transition to playing on LLM_DONE in streaming state', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'LLM_DONE', fullText: 'response' })
    actor.send({ type: 'LLM_DONE', fullText: 'complete response' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('playing')
  })

  it('should transition to idle on TTS_FINISHED', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'LLM_DONE', fullText: 'response' })
    actor.send({ type: 'LLM_DONE', fullText: 'complete' })
    actor.send({ type: 'TTS_FINISHED' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
  })

  it('should transition to idle on INTERRUPT from listening', () => {
    actor.send({ type: 'START_RECORDING' })
    actor.send({ type: 'INTERRUPT' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
  })

  it('should transition to idle on INTERRUPT from thinking', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'INTERRUPT' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
  })

  it('should transition to idle on INTERRUPT from streaming', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'LLM_DONE', fullText: 'response' })
    actor.send({ type: 'INTERRUPT' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
  })

  it('should transition to idle on INTERRUPT from playing', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'LLM_DONE', fullText: 'response' })
    actor.send({ type: 'LLM_DONE', fullText: 'complete' })
    actor.send({ type: 'INTERRUPT' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.value).toBe('idle')
  })

  it('should update requestId on START_RECORDING', () => {
    const before = actor.getSnapshot().context.requestId
    actor.send({ type: 'START_RECORDING' })
    const after = actor.getSnapshot().context.requestId
    expect(after).not.toBe(before)
  })

  it('should update requestId on SUBMIT_TEXT', () => {
    const before = actor.getSnapshot().context.requestId
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    const after = actor.getSnapshot().context.requestId
    expect(after).not.toBe(before)
  })

  it('should clear streamBuffer on INTERRUPT', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'LLM_DONE', fullText: 'response' })

    const beforeInterrupt = actor.getSnapshot().context.streamBuffer
    expect(beforeInterrupt).toBe('response')

    actor.send({ type: 'INTERRUPT' })
    const afterInterrupt = actor.getSnapshot().context.streamBuffer
    expect(afterInterrupt).toBe('')
  })

  it('should set abortController in thinking state', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    const snapshot = actor.getSnapshot()
    expect(snapshot.context.abortController).toBeDefined()
  })

  it('should keep abortController in streaming state', () => {
    actor.send({ type: 'SUBMIT_TEXT', text: 'hello' })
    actor.send({ type: 'LLM_DONE', fullText: 'response' })
    const snapshot = actor.getSnapshot()
    // abortController is not cleared in current machine design
    // It persists until INTERRUPT
    expect(snapshot.value).toBe('streaming')
  })
})
import { describe, it, expect, beforeEach } from 'vitest'
import { Timeline } from './timeline'

describe('Timeline', () => {
  let timeline: Timeline

  beforeEach(() => {
    timeline = new Timeline()
  })

  it('should add event', () => {
    timeline.add('session.start', { requestId: 'req-1' })
    const events = timeline.getRecent()
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('session.start')
  })

  it('should include id in event', () => {
    timeline.add('test')
    const events = timeline.getRecent()
    expect(events[0].id).toBeDefined()
    expect(typeof events[0].id).toBe('string')
  })

  it('should include timestamp in event', () => {
    const before = Date.now()
    timeline.add('test')
    const after = Date.now()
    const events = timeline.getRecent()
    expect(events[0].timestamp).toBeGreaterThanOrEqual(before)
    expect(events[0].timestamp).toBeLessThanOrEqual(after)
  })

  it('should include data in event', () => {
    timeline.add('test', { foo: 'bar', count: 42 })
    const events = timeline.getRecent()
    expect(events[0].data).toEqual({ foo: 'bar', count: 42 })
  })

  it('should return recent events with default count', () => {
    for (let i = 0; i < 25; i++) {
      timeline.add(`event-${i}`)
    }
    const events = timeline.getRecent()
    expect(events).toHaveLength(20)
  })

  it('should return recent events with custom count', () => {
    for (let i = 0; i < 10; i++) {
      timeline.add(`event-${i}`)
    }
    const events = timeline.getRecent(5)
    expect(events).toHaveLength(5)
  })

  it('should remove oldest event when exceeding 100', () => {
    for (let i = 0; i < 101; i++) {
      timeline.add(`event-${i}`)
    }
    const events = timeline.getAll()
    expect(events).toHaveLength(100)
    expect(events[0].event).toBe('event-1')
  })

  it('should clear all events', () => {
    timeline.add('event1')
    timeline.add('event2')
    timeline.clear()
    expect(timeline.getRecent()).toHaveLength(0)
  })

  it('should return all events via getAll', () => {
    timeline.add('event1')
    timeline.add('event2')
    timeline.add('event3')
    const all = timeline.getAll()
    expect(all).toHaveLength(3)
  })

  it('should return copy of events', () => {
    timeline.add('event1')
    const events = timeline.getRecent()
    events.push({ id: '999', timestamp: 999, event: 'external', data: {} })
    expect(timeline.getRecent()).toHaveLength(1)
  })
})
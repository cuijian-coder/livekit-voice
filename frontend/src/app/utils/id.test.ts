import { describe, it, expect } from 'vitest'
import { generateId } from './id'

describe('generateId', () => {
  it('should return a string', () => {
    const id = generateId()
    expect(typeof id).toBe('string')
  })

  it('should return unique ids', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateId())
    }
    expect(ids.size).toBe(100)
  })

  it('should contain timestamp', () => {
    const before = Date.now()
    const id = generateId()
    const after = Date.now()

    const timestamp = parseInt(id.split('-')[0])
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  it('should contain random string', () => {
    const id = generateId()
    const parts = id.split('-')

    expect(parts.length).toBeGreaterThanOrEqual(2)
    expect(parts[1]).toBeDefined()
    expect(parts[1].length).toBeGreaterThan(0)
  })

  it('should return id with at least 2 parts', () => {
    const id = generateId()
    const parts = id.split('-')

    expect(parts.length).toBeGreaterThanOrEqual(2)
  })

  it('should not contain special characters', () => {
    const id = generateId()
    expect(id).toMatch(/^[0-9a-z-]+$/)
  })
})
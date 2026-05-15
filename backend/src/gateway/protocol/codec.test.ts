import { describe, it, expect } from 'vitest'
import { encodeMessage, decodeMessage, validateMessageSize, validateBinarySize } from './codec'

describe('Protocol Codec', () => {
  it('should encode/decode state.update', () => {
    const msg = { type: 'state.update', state: 'listening', turnId: 't1' }
    const encoded = encodeMessage(msg)
    const decoded = decodeMessage(encoded)
    expect(decoded).toEqual(msg)
  })

  it('should encode/decode asr.partial', () => {
    const msg = { type: 'asr.partial', text: 'hello', turnId: 't1' }
    const encoded = encodeMessage(msg)
    const decoded = decodeMessage(encoded)
    expect(decoded).toEqual(msg)
  })

  it('should encode/decode audio message with base64 data', () => {
    const msg = { type: 'audio', data: 'SGVsbG8gV29ybGQ=', turnId: 't1' } as any
    const encoded = encodeMessage(msg)
    const decoded = decodeMessage(encoded)
    expect(decoded).toEqual(msg)
  })

  it('should decode from Buffer', () => {
    const msg = { type: 'session.init' }
    const buf = Buffer.from(JSON.stringify(msg))
    const decoded = decodeMessage(buf)
    expect(decoded).toEqual(msg)
  })

  it('should throw on missing type', () => {
    const msg = { data: 'test' } as any
    expect(() => decodeMessage(JSON.stringify(msg))).toThrow('Invalid message: missing type')
  })

  it('should throw on invalid audio data type', () => {
    const msg = { type: 'audio', data: 123 } as any
    expect(() => decodeMessage(JSON.stringify(msg))).toThrow('Invalid audio message: data must be base64 string')
  })

  it('should validate message size', () => {
    const small = JSON.stringify({ type: 'ping' })
    expect(validateMessageSize(small)).toBe(true)
    expect(validateMessageSize(Buffer.from(small))).toBe(true)
  })

  it('should reject oversized message', () => {
    const large = JSON.stringify({ type: 'test', data: 'x'.repeat(5000) })
    expect(validateMessageSize(large)).toBe(false)
  })

  it('should validate binary size', () => {
    const small = Buffer.alloc(1024)
    expect(validateBinarySize(small)).toBe(true)
  })

  it('should reject oversized binary', () => {
    const large = Buffer.alloc(100 * 1024)
    expect(validateBinarySize(large)).toBe(false)
  })
})
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./websocket-client', () => ({
  wsClient: {
    sendBinary: vi.fn(),
    send: vi.fn(),
  }
}))

vi.mock('../../../../../self-healing/assert', () => ({
  invariant: (cond: boolean, msg?: string) => {
    if (!cond) throw new Error(msg || 'Invariant failed')
  },
  assertNotNull: (v: any, msg?: string) => {
    if (v == null) throw new Error(msg || 'Value is null')
    return v
  },
}))

import { BinaryTransport } from './binary-transport'
import { wsClient } from './websocket-client'

describe('BinaryTransport', () => {
  let transport: BinaryTransport

  beforeEach(() => {
    vi.clearAllMocks()
    transport = new BinaryTransport()
  })

  it('should reset lastSeq to -1 on startTurn', () => {
    transport.startTurn('turn-1')
    transport.sendFrame({ seq: 0, pcm: new Uint8Array([1, 2, 3]) })
    transport.sendFrame({ seq: 1, pcm: new Uint8Array([4, 5, 6]) })

    // Start new turn - lastSeq should reset
    transport.startTurn('turn-2')
    expect(() => {
      transport.sendFrame({ seq: 0, pcm: new Uint8Array([7, 8, 9]) })
    }).not.toThrow()
  })

  it('should reject sendFrame before startTurn', () => {
    expect(() => {
      transport.sendFrame({ seq: 0, pcm: new Uint8Array([1, 2, 3]) })
    }).toThrow('binaryTransport must be active before sendFrame')
  })

  it('should track lastSeq correctly within a turn', () => {
    transport.startTurn('turn-1')
    transport.sendFrame({ seq: 5, pcm: new Uint8Array([1, 2, 3]) })
    transport.sendFrame({ seq: 10, pcm: new Uint8Array([4, 5, 6]) })

    transport.commit()

    const commitCall = vi.mocked(wsClient.send).mock.calls.find(
      (call: any) => call[0].type === 'audio.commit'
    )
    expect(commitCall).toBeDefined()
    expect(commitCall![0].finalSeq).toBe(10)
  })

  it('should ignore commit when no frames sent', () => {
    transport.startTurn('turn-1')
    transport.commit()

    const commitCall = vi.mocked(wsClient.send).mock.calls.find(
      (call: any) => call[0].type === 'audio.commit'
    )
    expect(commitCall).toBeUndefined()
  })

  it('should allow multiple turns with proper seq isolation', () => {
    // Turn 1: seq 0-99
    transport.startTurn('turn-1')
    for (let i = 0; i < 100; i++) {
      transport.sendFrame({ seq: i, pcm: new Uint8Array([1, 2]) })
    }
    transport.commit()

    // Turn 2: seq should start fresh
    transport.startTurn('turn-2')
    transport.sendFrame({ seq: 0, pcm: new Uint8Array([3, 4]) })
    transport.sendFrame({ seq: 1, pcm: new Uint8Array([5, 6]) })

    transport.commit()

    const allCalls = vi.mocked(wsClient.send).mock.calls
    const turn2Commit = allCalls.find(
      (call: any) => call[0].type === 'audio.commit' && call[0].turnId === 'turn-2'
    )
    expect(turn2Commit).toBeDefined()
    expect(turn2Commit![0].finalSeq).toBe(1)
  })
})

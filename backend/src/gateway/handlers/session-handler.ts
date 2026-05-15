import type { WebSocket } from 'ws'
import { encodeMessage, decodeMessage, validateMessageSize, validateBinarySize } from '../protocol/codec.js'

const MAX_JSON_SIZE = 4 * 1024
const MAX_BINARY_SIZE = 64 * 1024

export function sendMessage(ws: WebSocket, msg: any): void {
  if (ws.readyState !== ws.OPEN) return
  const payload = encodeMessage(msg)
  if (!validateMessageSize(payload)) {
    throw new Error('Message too large')
  }
  ws.send(payload)
}

export function parseMessage(raw: string | Buffer): any {
  return decodeMessage(raw)
}

export function isValidBinaryFrame(data: Buffer): boolean {
  return validateBinarySize(data)
}

export function sendBinary(ws: WebSocket, data: Buffer): void {
  if (ws.readyState !== ws.OPEN) return
  if (!validateBinarySize(data)) {
    throw new Error('Binary frame too large')
  }
  ws.send(data, { binary: true })
}
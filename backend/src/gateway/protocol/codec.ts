export function encodeMessage(msg: any): string {
  return JSON.stringify(msg)
}

export function decodeMessage(raw: string | Buffer): any {
  if (Buffer.isBuffer(raw)) {
    raw = raw.toString('utf-8')
  }
  const msg = JSON.parse(raw)

  if (!msg.type) {
    throw new Error('Invalid message: missing type')
  }

  if (msg.type === 'audio') {
    if (typeof msg.data !== 'string') {
      throw new Error('Invalid audio message: data must be base64 string')
    }
  }

  return msg
}

const MAX_JSON_SIZE = 4 * 1024
const MAX_BINARY_SIZE = 64 * 1024

export function validateMessageSize(data: string | Buffer): boolean {
  const size = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data, 'utf-8')
  return size <= MAX_JSON_SIZE
}

export function validateBinarySize(data: Buffer): boolean {
  return data.length <= MAX_BINARY_SIZE
}
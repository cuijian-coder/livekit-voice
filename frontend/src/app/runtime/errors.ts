export const ErrorType = {
  Permission: 'permission',
  Device: 'device',
  Websocket: 'websocket',
  Network: 'network',
  Logic: 'logic',
} as const

export type ErrorType = typeof ErrorType[keyof typeof ErrorType]

export const ErrorCodes = {
  MIC001: 'MicrophonePermissionDenied',
  MIC002: 'MicrophoneDeviceNotFound',
  WS001: 'WebsocketConnectionFailed',
  WS002: 'WebsocketDisconnected',
  ASR001: 'AsrStreamError',
  LLM001: 'LlmGenerationError',
  TTS001: 'TtsSynthesisError',
  TTS002: 'TtsPlaybackError',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

export interface StructuredError {
  type: ErrorType
  code: ErrorCode
  message: string
  context?: Record<string, unknown>
}

export function createError(
  type: ErrorType,
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>
): StructuredError {
  return { type, code, message, context }
}

export function parseDomException(error: unknown): ErrorCode | null {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return ErrorCodes.MIC001
      case 'NotFoundError':
        return ErrorCodes.MIC002
      case 'NotReadableError':
        return ErrorCodes.MIC002
      default:
        return null
    }
  }
  return null
}

export function getErrorType(error: unknown): ErrorType {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return ErrorType.Permission
      case 'NotFoundError':
      case 'NotReadableError':
        return ErrorType.Device
      default:
        return ErrorType.Device
    }
  }
  return ErrorType.Logic
}
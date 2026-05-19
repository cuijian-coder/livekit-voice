import type { Logger } from 'pino'
import { getConfig } from '../../infra/config/config.js'

export interface TtsWorker {
  stream(text: string, signal: AbortSignal, logger?: Logger): AsyncIterable<Buffer>
}

export class QwenTtsWorker implements TtsWorker {
  private config = getConfig()
  private httpUrl = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer'

  async *stream(text: string, signal: AbortSignal, logger?: Logger): AsyncIterable<Buffer> {
    logger?.debug({ model: this.config.TTS_MODEL, voice: this.config.TTS_VOICE, textLength: text.length }, 'dashscope.tts.request')

    const response = await fetch(this.httpUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.QWEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.TTS_MODEL,
        input: {
          text,
          voice: this.config.TTS_VOICE,
          format: this.config.TTS_FORMAT,
          sample_rate: this.config.TTS_SAMPLE_RATE,
        },
      }),
      signal,
    })

    if (!response.ok) {
      const error = await response.text()
      const err = new Error(`TTS HTTP error: ${response.status} ${error}`)
      logger?.error({ status: response.status, error }, 'dashscope.tts.error')
      throw err
    }

    const json = await response.json() as any

    if (json.code) {
      const err = new Error(`TTS API error: ${json.code} ${json.message}`)
      logger?.error({ code: json.code, message: json.message }, 'dashscope.tts.api_error')
      throw err
    }

    const audioUrl = json.output?.audio?.url
    if (!audioUrl) {
      const err = new Error('TTS response missing audio URL')
      logger?.error({ response: json }, 'dashscope.tts.no_url')
      throw err
    }

    logger?.debug({ audioUrl }, 'dashscope.tts.audio_url_received')

    const audioResponse = await fetch(audioUrl, { signal })
    if (!audioResponse.ok) {
      const err = new Error(`TTS audio fetch error: ${audioResponse.status}`)
      logger?.error({ status: audioResponse.status }, 'dashscope.tts.audio_fetch_error')
      throw err
    }

    const arrayBuffer = await audioResponse.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)
    logger?.debug({ bytes: audioBuffer.length }, 'dashscope.tts.audio_received')

    yield audioBuffer
  }
}

export class MockTtsWorker implements TtsWorker {
  async *stream(text: string, signal: AbortSignal, logger?: Logger): AsyncIterable<Buffer> {
    await new Promise((resolve) => setTimeout(resolve, 50))
    if (signal.aborted) return
    yield Buffer.from(`[mock TTS audio for: ${text.slice(0, 30)}...]`)
  }
}

export class MockTtsWorker2 implements TtsWorker {
  async *stream(text: string, signal: AbortSignal, logger?: Logger): AsyncIterable<Buffer> {
    await new Promise((resolve) => setTimeout(resolve, 30))
    if (signal.aborted) return
    yield Buffer.from(`[mock TTS for "${text.slice(0, 20)}"]`)
  }
}
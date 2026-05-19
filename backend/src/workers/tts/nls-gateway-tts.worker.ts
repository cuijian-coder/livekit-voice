import { getConfig } from '../../infra/config/config.js'
import type { Logger } from 'pino'

export interface TtsWorker {
  stream(text: string, signal: AbortSignal, logger?: Logger): AsyncIterable<Buffer>
}

export class NlsGatewayTtsWorker implements TtsWorker {
  private config = getConfig()
  private baseUrl = 'https://nls-gateway-cn-shanghai.aliyuncs.com'
  private pollIntervalMs = 500
  private pollMaxAttempts = 40

  async *stream(text: string, signal: AbortSignal, logger?: Logger): AsyncIterable<Buffer> {
    const appkey = this.config.NLS_TTS_APPKEY
    const token = this.config.NLS_TTS_TOKEN
    const voice = this.config.NLS_TTS_VOICE || 'xiaoyun'
    const format = this.config.NLS_TTS_FORMAT || 'wav'
    const sampleRate = this.config.NLS_TTS_SAMPLE_RATE || 16000

    logger?.debug({ textLength: text.length, voice, format, sampleRate }, 'nls.tts.submit')

    const taskId = await this.submitTask(appkey, token, voice, format, sampleRate, text)
    logger?.debug({ taskId }, 'nls.tts.task_submitted')

    const audioUrl = await this.pollTaskResult(appkey, token, taskId, signal, logger)
    logger?.debug({ audioUrl }, 'nls.tts.audio_ready')

    const audioData = await this.downloadAudio(audioUrl, signal, logger)
    logger?.debug({ audioSize: audioData.length }, 'nls.tts.downloaded')

    const chunkSize = 4096
    for (let offset = 0; offset < audioData.length; offset += chunkSize) {
      if (signal.aborted) break
      yield audioData.slice(offset, offset + chunkSize)
    }
  }

  private async submitTask(
    appkey: string,
    token: string,
    voice: string,
    format: string,
    sampleRate: number,
    text: string
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/rest/v1/tts/async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: {
          tts_request: {
            voice,
            sample_rate: sampleRate,
            format,
            text,
            enable_subtitle: false,
          },
          enable_notify: false,
        },
        context: { device_id: 'livekit-voice-session' },
        header: { appkey, token },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`NLS TTS submit failed: ${response.status} ${err}`)
    }

    const result = await response.json() as any
    if (result.error_code !== 20000000) {
      throw new Error(`NLS TTS submit error: ${result.error_code} ${result.error_message}`)
    }

    return result.data.task_id as string
  }

  private async pollTaskResult(
    appkey: string,
    token: string,
    taskId: string,
    signal: AbortSignal,
    logger?: Logger
  ): Promise<string> {
    for (let attempt = 0; attempt < this.pollMaxAttempts; attempt++) {
      if (signal.aborted) throw new Error('aborted')

      await this.sleep(this.pollIntervalMs)

      const url = `${this.baseUrl}/rest/v1/tts/async?task_id=${taskId}&appkey=${appkey}&token=${token}`
      const response = await fetch(url)

      if (!response.ok) {
        const err = await response.text()
        logger?.warn({ attempt, status: response.status, err }, 'nls.tts.poll.error')
        continue
      }

      const result = await response.json() as any
      logger?.debug({ attempt, error_code: result.error_code, error_message: result.error_message, hasData: !!result.data, dataKeys: result.data ? Object.keys(result.data) : [] }, 'nls.tts.poll.result')

      if (result.error_code === 20000000) {
        if (result.data?.audio_address) {
          return result.data.audio_address as string
        }
        if (result.error_message === 'SYNTHESIS_SUCCESS' || result.error_message === 'SUCCESS') {
          logger?.error({ result }, 'nls.tts.no_audio_address')
          throw new Error(`NLS TTS completed but no audio_address returned (code: ${result.error_code})`)
        }
        logger?.debug({ attempt, error_message: result.error_message }, 'nls.tts.poll.queueing')
        continue
      }

      if (result.error_code === 10000000 || result.error_code === 10001003) {
        logger?.debug({ attempt, error: result.error_message }, 'nls.tts.poll.pending')
        continue
      }

      logger?.warn({ attempt, error: result.error_message }, 'nls.tts.poll.error')
    }

    throw new Error(`NLS TTS polling timeout after ${this.pollMaxAttempts} attempts`)
  }

  private async downloadAudio(url: string, signal: AbortSignal, logger?: Logger): Promise<Buffer> {
    const response = await fetch(url, { signal })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`NLS TTS audio download failed: ${response.status} ${err}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export class MockTtsWorker implements TtsWorker {
  async *stream(text: string, signal: AbortSignal, logger?: Logger): AsyncIterable<Buffer> {
    await new Promise(resolve => setTimeout(resolve, 50))
    if (signal.aborted) return
    yield Buffer.from(`[mock TTS audio for: ${text.slice(0, 30)}...]`)
  }
}

export class MockTtsWorker2 implements TtsWorker {
  async *stream(text: string, signal: AbortSignal, logger?: Logger): AsyncIterable<Buffer> {
    await new Promise(resolve => setTimeout(resolve, 30))
    if (signal.aborted) return
    yield Buffer.from(`[mock TTS for "${text.slice(0, 20)}"]`)
  }
}
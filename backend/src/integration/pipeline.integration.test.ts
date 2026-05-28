import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { getConfig } from '../infra/config/config.js'
import { QwenAsrWorker } from '../workers/asr/qwen-asr.worker.js'
import { QwenLlmWorker } from '../workers/llm/qwen-llm.worker.js'
import { AliyunStreamingTtsWorker } from '../workers/tts/aliyun-streaming-tts.worker.js'

// Configure undici proxy for integration tests
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'
setGlobalDispatcher(new EnvHttpProxyAgent())

describe('Integration: ASR + LLM + TTS Pipeline', () => {
  let config: ReturnType<typeof getConfig>
  let asrWorker: QwenAsrWorker
  let llmWorker: QwenLlmWorker
  let ttsWorker: AliyunStreamingTtsWorker

  beforeAll(() => {
    config = getConfig()
    asrWorker = new QwenAsrWorker()
    llmWorker = new QwenLlmWorker()
    ttsWorker = new AliyunStreamingTtsWorker()
  })

  it('should load valid configuration', () => {
    expect(config.QWEN_API_KEY).toBeTruthy()
    expect(config.QWEN_API_KEY.length).toBeGreaterThan(10)
    expect(config.QWEN_API_BASE).toContain('dashscope')
    expect(config.ASR_MODEL).toBe('fun-asr-realtime')
    expect(config.ASR_SAMPLE_RATE).toBe(16000)
    expect(config.LLM_MODEL).toBe('qwen-turbo')
    expect(config.LLM_TEMPERATURE).toBe(0.7)
    expect(config.LLM_MAX_TOKENS).toBe(2000)
    expect(config.TTS_MODE).toBe('websocket')
    expect(config.NLS_TTS_APPKEY).toBeTruthy()
    expect(config.NLS_TTS_TOKEN).toBeTruthy()
    expect(config.NLS_TTS_WEBSOCKET_URL).toContain('wss://')
  })

  it('should transcribe audio with real ASR', async () => {
    const wavPath = resolve(process.cwd(), '../self-healing/e2e/fixtures/audio/nls-sample-16k.wav')
    const audioData = readFileSync(wavPath)
    // Skip 44-byte WAV header, use raw PCM
    const pcmData = audioData.slice(44)

    const signal = new AbortController().signal
    const audioStream = (async function* () {
      // Stream in chunks to simulate real-time
      const chunkSize = 3200 // 100ms at 16kHz
      for (let offset = 0; offset < pcmData.length; offset += chunkSize) {
        yield pcmData.slice(offset, Math.min(offset + chunkSize, pcmData.length))
        await new Promise(r => setTimeout(r, 100))
      }
    })()

    const results: { text: string; isFinal: boolean }[] = []
    for await (const result of asrWorker.stream(audioStream, signal)) {
      results.push(result)
      if (result.isFinal) break
    }

    expect(results.length).toBeGreaterThan(0)
    const finalResult = results.find(r => r.isFinal)
    expect(finalResult).toBeDefined()
    expect(finalResult!.text.length).toBeGreaterThan(0)
    console.log('ASR result:', finalResult!.text)
  }, 30000)

  it('should generate text with real LLM', async () => {
    const signal = new AbortController().signal
    const prompt = '你好，请用一句话介绍自己'

    const tokens: string[] = []
    for await (const token of llmWorker.stream(prompt, signal)) {
      tokens.push(token)
    }

    expect(tokens.length).toBeGreaterThan(0)
    const fullText = tokens.join('')
    expect(fullText.length).toBeGreaterThan(5)
    console.log('LLM result:', fullText.slice(0, 100))
  }, 30000)

  it('should synthesize speech with real TTS', async () => {
    const signal = new AbortController().signal
    const text = '你好，这是一个语音合成测试'

    const chunks: Buffer[] = []
    for await (const chunk of ttsWorker.stream(text, signal)) {
      chunks.push(chunk)
    }

    expect(chunks.length).toBeGreaterThan(0)
    const totalSize = chunks.reduce((sum, c) => sum + c.length, 0)
    expect(totalSize).toBeGreaterThan(100)
    console.log('TTS chunks:', chunks.length, 'Total size:', totalSize)
  }, 30000)

  it('should run full pipeline: Audio → ASR → LLM → TTS', async () => {
    // Step 1: ASR
    const wavPath = resolve(process.cwd(), '../self-healing/e2e/fixtures/audio/nls-sample-16k.wav')
    const audioData = readFileSync(wavPath)
    const pcmData = audioData.slice(44)

    const asrSignal = new AbortController().signal
    const audioStream = (async function* () {
      const chunkSize = 3200
      for (let offset = 0; offset < pcmData.length; offset += chunkSize) {
        yield pcmData.slice(offset, Math.min(offset + chunkSize, pcmData.length))
        await new Promise(r => setTimeout(r, 100))
      }
    })()

    let transcript = ''
    for await (const result of asrWorker.stream(audioStream, asrSignal)) {
      if (result.isFinal) {
        transcript = result.text
        break
      }
    }

    expect(transcript.length).toBeGreaterThan(0)
    console.log('Pipeline ASR:', transcript)

    // Step 2: LLM
    const llmSignal = new AbortController().signal
    const llmPrompt = transcript || '你好'
    const tokens: string[] = []
    for await (const token of llmWorker.stream(llmPrompt, llmSignal)) {
      tokens.push(token)
    }
    const response = tokens.join('')
    expect(response.length).toBeGreaterThan(5)
    console.log('Pipeline LLM:', response.slice(0, 100))

    // Step 3: TTS
    const ttsSignal = new AbortController().signal
    const chunks: Buffer[] = []
    for await (const chunk of ttsWorker.stream(response, ttsSignal)) {
      chunks.push(chunk)
    }
    expect(chunks.length).toBeGreaterThan(0)
    console.log('Pipeline TTS: generated', chunks.length, 'chunks')

    // Verify pipeline stats
    console.log('✅ Full pipeline complete:')
    console.log('   ASR transcript length:', transcript.length)
    console.log('   LLM response length:', response.length)
    console.log('   TTS audio chunks:', chunks.length)
  }, 60000)
})

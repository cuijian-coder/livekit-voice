import type { Logger } from 'pino'
import { getConfig } from '../../infra/config/config.js'

export interface LlmWorker {
  stream(prompt: string, signal: AbortSignal, logger?: Logger): AsyncIterable<string>
}

export class QwenLlmWorker implements LlmWorker {
  private config = getConfig()

  async *stream(prompt: string, signal: AbortSignal, logger?: Logger): AsyncIterable<string> {
    logger?.debug({ model: this.config.LLM_MODEL, promptLength: prompt.length }, 'dashscope.llm.request')

    const response = await fetch(`${this.config.QWEN_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.QWEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.LLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        temperature: this.config.LLM_TEMPERATURE,
        max_tokens: this.config.LLM_MAX_TOKENS,
      }),
      signal,
    })

    if (!response.ok) {
      const error = await response.text()
      logger?.error({ status: response.status, error }, 'dashscope.llm.error')
      throw new Error(`LLM API error: ${response.status} ${error}`)
    }

    if (!response.body) {
      throw new Error('LLM response body is null')
    }

    logger?.debug({ status: response.status }, 'dashscope.llm.response_started')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let tokenCount = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '))

        for (const line of lines) {
          if (signal.aborted) return
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            logger?.debug({ tokenCount }, 'dashscope.llm.done')
            return
          }
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              tokenCount++
              yield content
            }
          } catch {
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

export class MockLlmWorker implements LlmWorker {
  async *stream(prompt: string, signal: AbortSignal, logger?: Logger): AsyncIterable<string> {
    const response = `这是一个模拟的 LLM 响应。你说的是: ${prompt.slice(0, 50)}...`
    const words = response.split('')
    for (const word of words) {
      if (signal.aborted) return
      await new Promise(resolve => setTimeout(resolve, 20))
      yield word
    }
  }
}
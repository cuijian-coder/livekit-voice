import { getLogger } from '@livekit-voice/shared/logger'

const logger = getLogger()

const MOCK_RESPONSES = [
  "Hello! I'm your AI voice assistant. How can I help you today?",
  "That's a great question! Let me think about it...",
  "I can help you with many tasks like answering questions, providing information, or just having a conversation.",
  "The weather today is sunny with a chance of clouds. Perfect for a walk!",
  "I'm currently in a demo mode, simulating AI responses. In the future, I'll be connected to a real AI backend.",
  "Do you need help with coding, writing, or perhaps just want to chat?",
  "Interesting! Tell me more about what you're thinking.",
  "I can understand voice input and respond with text. The voice synthesis will come in a later phase!",
]

export function getMockResponse(_userMessage: string): Promise<string> {
  return new Promise((resolve) => {
    const randomResponse = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
    logger.debug('mockLLM.response.selected', { responseLength: randomResponse.length })
    setTimeout(() => resolve(randomResponse), 500)
  })
}

export async function* mockStreamResponse(userMessage: string): AsyncGenerator<string> {
  logger.debug('mockLLM.stream.starting', { message: userMessage.slice(0, 50) })
  const response = await getMockResponse(userMessage)
  const words = response.split(' ')

  for (let i = 0; i < words.length; i++) {
    yield words.slice(0, i + 1).join(' ') + (i < words.length - 1 ? ' ' : '')
    await new Promise((r) => setTimeout(r, 50))
  }

  logger.debug('mockLLM.stream.complete')
}
export async function* mockASRStream(
  _signal: AbortSignal
): AsyncGenerator<string> {
  const mockPhrases = ['Hello', 'how are', 'you doing', 'today'];

  for (const phrase of mockPhrases) {
    if (_signal.aborted) {
      throw new Error('ASR aborted');
    }

    await sleep(200 + Math.random() * 100);
    yield phrase;
  }
}

export async function* mockLLMStream(
  input: string,
  signal: AbortSignal
): AsyncGenerator<string> {
  const fullResponse = generateMockResponse(input);
  const words = fullResponse.split(' ');

  for (let i = 0; i < words.length; i++) {
    if (signal.aborted) {
      throw new Error('LLM aborted');
    }

    const isPunctuation = /[.,!?;:]/.test(words[i]);
    const delay = isPunctuation ? 200 + Math.random() * 200 : 60 + Math.random() * 60;

    await sleep(delay);

    const chunk = words.slice(0, i + 1).join(' ');
    yield chunk;
  }
}

export async function* mockTTSPlayback(
  _text: string,
  signal: AbortSignal
): AsyncGenerator<void> {
  const chunks = 5;

  for (let i = 0; i < chunks; i++) {
    if (signal.aborted) {
      throw new Error('TTS aborted');
    }

    await sleep(300 + Math.random() * 200);
    yield;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateMockResponse(input: string): string {
  const responses = [
    "I understand you're saying: " + input + ". Let me think about that.",
    "That's an interesting point. Here's my perspective on this.",
    "Thank you for sharing. I can help you with that request.",
    "I see what you mean. Let me provide some helpful information.",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

export function createAbortController(): AbortController {
  return new AbortController();
}
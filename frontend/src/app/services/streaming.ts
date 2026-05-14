type ChunkCallback = (text: string) => void;
type CompleteCallback = () => void;

interface StreamOptions {
  onChunk: ChunkCallback;
  onComplete: CompleteCallback;
  delay?: number;
  chunkSize?: number;
}

let currentController: AbortController | null = null;

export function streamText(_text: string, options: StreamOptions): () => void {
  const { onChunk, onComplete, delay = 30, chunkSize = 2 } = options;

  currentController = new AbortController();
  const signal = currentController.signal;

  let index = 0;
  let accumulated = '';

  function processNext(): void {
    if (signal.aborted) return;

    const chunk = _text.slice(index, index + chunkSize);
    if (!chunk) {
      onComplete();
      currentController = null;
      return;
    }

    accumulated += chunk;
    index += chunkSize;
    onChunk(accumulated);

    setTimeout(processNext, delay);
  }

  processNext();

  return () => {
    currentController?.abort();
    currentController = null;
  };
}

export function cancelStream(): void {
  currentController?.abort();
  currentController = null;
}
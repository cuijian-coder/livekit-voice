import { FrontendDiagnosticsCollector } from './diagnostics-collector'
import { pcmPipeline } from './audio/pcm-pipeline'

const collector = new FrontendDiagnosticsCollector()

declare global {
  interface Window {
    __VOICE_DEBUG__?: {
      getSnapshot: () => ReturnType<FrontendDiagnosticsCollector['snapshot']>
      getEvents: () => ReturnType<FrontendDiagnosticsCollector['getEvents']>
      exportState: () => ReturnType<FrontendDiagnosticsCollector['exportState']>
      getPipelineStats: () => ReturnType<typeof pcmPipeline.getDiagnostics>
      getSpeechDetectorState: () => string
    }
  }
}

if (import.meta.env.DEV) {
  window.__VOICE_DEBUG__ = {
    getSnapshot: () => collector.snapshot(),
    getEvents: () => collector.getEvents(),
    exportState: () => collector.exportState(),
    getPipelineStats: () => pcmPipeline.getDiagnostics(),
    getSpeechDetectorState: () => {
      const sd = (window as any).__SPEECH_DETECTOR__
      return sd ? sd.getState() : 'not available'
    }
  }
}

export { collector as diagnosticsCollector }
import { FrontendDiagnosticsCollector } from './diagnostics-collector'

const collector = new FrontendDiagnosticsCollector()

declare global {
  interface Window {
    __VOICE_DEBUG__?: {
      getSnapshot: () => ReturnType<FrontendDiagnosticsCollector['snapshot']>
      getEvents: () => ReturnType<FrontendDiagnosticsCollector['getEvents']>
      exportState: () => ReturnType<FrontendDiagnosticsCollector['exportState']>
    }
  }
}

if (import.meta.env.DEV) {
  window.__VOICE_DEBUG__ = {
    getSnapshot: () => collector.snapshot(),
    getEvents: () => collector.getEvents(),
    exportState: () => collector.exportState()
  }
}

export { collector as diagnosticsCollector }
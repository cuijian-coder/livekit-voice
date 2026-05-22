import { createActor } from 'xstate';
import { voiceMachine } from '../machine';
import { getLogger } from '@livekit-voice/shared/logger';
import { diagnosticsCollector } from '../../runtime/debug-provider';
import { audioRecorder } from '../../runtime/audio/recorder';
import { pcmPipeline } from '../../runtime/audio/pcm-pipeline';
import { speechDetector } from '../../runtime/audio/speech-detector';
import { chatStore } from '../../state/chatStore';

const logger = getLogger();

export const voiceActor = createActor(voiceMachine);

let prevState = 'idle'

voiceActor.subscribe((snapshot: any) => {
  const state = snapshot.value as string

  if (state !== prevState) {
    diagnosticsCollector.add({
      source: 'conversation.machine',
      type: 'state.entered',
      metadata: { state, from: prevState },
      turnId: snapshot.context.turnId
    })

    const audioState = {
      recording: state === 'listening' || state === 'transcribing',
      playing: state === 'speaking'
    }

    diagnosticsCollector.updateState({
      conversation: { state, turnId: snapshot.context.turnId || '' },
      audio: audioState
    })

    logger.debug('voice.state', { state, turnId: snapshot.context.turnId })
    prevState = state
  }
});

voiceActor.start();

initEnvironmentDiagnostics()

async function initEnvironmentDiagnostics() {
  diagnosticsCollector.updateState({
    environment: {
      secureContext: window.isSecureContext,
      mediaDevicesSupported: !!navigator.mediaDevices,
      audioContextState: 'unknown',
      userAgent: navigator.userAgent,
    }
  })

  if (navigator.permissions && navigator.mediaDevices) {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      diagnosticsCollector.updateState({
        permissions: { microphone: result.state as 'granted' | 'denied' | 'prompt' }
      })
      result.onchange = () => {
        diagnosticsCollector.updateState({
          permissions: { microphone: result.state as 'granted' | 'denied' | 'prompt' }
        })
      }
    } catch {
      logger.debug('permissions.query not supported')
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const hasAudioInput = devices.some(d => d.kind === 'audioinput')
      diagnosticsCollector.updateState({
        environment: {
          mediaDevicesSupported: hasAudioInput
        }
      })
    } catch {
      logger.debug('enumerateDevices not supported')
    }
  }
}

export function getVoiceActor() {
  return voiceActor;
}

declare global {
  interface Window {
    __VOICE_ACTOR__?: typeof voiceActor
    __CHAT_STORE__?: typeof chatStore
    __VOICE_TEST__?: {
      recorder: typeof audioRecorder
      pcmPipeline: typeof pcmPipeline
      getPipelineStats: () => ReturnType<typeof pcmPipeline.getDiagnostics>
      injectPcmData: (float32Data: Float32Array) => void
      loadWavFloat32: (url: string) => Promise<Float32Array>
      setMaxFramesUntilEnd: (count: number | undefined) => void
      setTestMode: (enabled: boolean) => void
    }
  }
}

if (import.meta.env.DEV) {
  window.__VOICE_ACTOR__ = voiceActor
  window.__CHAT_STORE__ = chatStore
  window.__VOICE_TEST__ = {
    recorder: audioRecorder,
    pcmPipeline: pcmPipeline,
    getPipelineStats: () => pcmPipeline.getDiagnostics(),
    injectPcmData: (float32Data: Float32Array) => {
      audioRecorder.injectPcmData(float32Data)
    },
    setMaxFramesUntilEnd: (count: number | undefined) => {
      speechDetector.setMaxFramesUntilEnd(count)
    },
    setTestMode: (enabled: boolean) => {
      audioRecorder.setTestMode(enabled)
    },
    loadWavFloat32: async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)
      const arrayBuffer = await response.arrayBuffer()
      const view = new DataView(arrayBuffer)

      const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
      if (riff !== 'RIFF') throw new Error('Not a valid WAV file: missing RIFF header')

      const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))
      if (wave !== 'WAVE') throw new Error('Not a valid WAV file: missing WAVE header')

      let offset = 12
      let dataOffset = 0
      let dataSize = 0

      while (offset < arrayBuffer.byteLength - 8) {
        const chunkId = String.fromCharCode(
          view.getUint8(offset),
          view.getUint8(offset + 1),
          view.getUint8(offset + 2),
          view.getUint8(offset + 3)
        )
        const chunkSize = view.getUint32(offset + 4, true)

        if (chunkId === 'data') {
          dataOffset = offset + 8
          dataSize = chunkSize
          break
        }

        offset += 8 + chunkSize
        if (chunkSize % 2 !== 0) offset += 1
      }

      if (dataOffset === 0) throw new Error('WAV file has no data chunk')

      const numSamples = Math.floor(dataSize / 2)
      const float32Data = new Float32Array(numSamples)

      let sampleIndex = 0
      for (let i = dataOffset; i < dataOffset + dataSize && i + 1 < arrayBuffer.byteLength; i += 2) {
        const int16Value = view.getInt16(i, true)
        float32Data[sampleIndex++] = int16Value / 32768.0
      }

      return float32Data
    }
  }
}
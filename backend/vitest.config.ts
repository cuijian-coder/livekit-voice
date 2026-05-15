import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@livekit-voice/shared': '/home/jiancui2026/projects/livekit-voice/packages/shared',
    },
  },
})
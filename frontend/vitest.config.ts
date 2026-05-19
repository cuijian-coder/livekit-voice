import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      DISABLE_INVARIANTS: 'true',
    },
  },
  resolve: {
    alias: {
      '@livekit-voice/shared': '/home/jiancui2026/projects/livekit-voice/packages/shared',
    },
  },
})
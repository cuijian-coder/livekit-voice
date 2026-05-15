import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@livekit-voice/shared': resolve(__dirname, '../packages/shared'),
      '@livekit-voice/shared/constants': resolve(__dirname, '../packages/shared/constants'),
      '@livekit-voice/shared/types': resolve(__dirname, '../packages/shared/types'),
      '@livekit-voice/shared/schemas': resolve(__dirname, '../packages/shared/schemas'),
      '@livekit-voice/shared/protocol': resolve(__dirname, '../packages/shared/protocol'),
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist']
  }
})
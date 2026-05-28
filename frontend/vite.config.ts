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
      '@livekit-voice/shared/logger': resolve(__dirname, '../packages/shared/logger'),
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    strictPort: true,
    cors: true,
    hmr: false,
    fs: {
      allow: ['..']
    },
    proxy: {
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      }
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist']
  }
})
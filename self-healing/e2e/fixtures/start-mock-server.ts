import { startMockWsServer } from './mock-ws-server'

const port = process.env.MOCK_WS_PORT ? parseInt(process.env.MOCK_WS_PORT, 10) : 3000

console.log('[MockServer] Starting mock server on port', port)

startMockWsServer({ port })
  .then((server) => {
    console.log(`[MockServer] Ready on port ${port}, clients:`, server.clientCount)
  })
  .catch((err) => {
    console.error('[MockServer] Failed to start:', err)
    process.exit(1)
  })

process.on('SIGTERM', () => {
  console.log('[MockServer] SIGTERM received, shutting down...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[MockServer] SIGINT received, shutting down...')
  process.exit(0)
})

import { startServer } from './app.js'
import { getConfig } from './infra/config/config.js'

async function main() {
  const config = getConfig()

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason)
    process.exit(1)
  })

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...')
    process.exit(0)
  })

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...')
    process.exit(0)
  })

  await startServer()
  console.log(`🚀 Server running on http://${config.HOST}:${config.PORT}`)
  console.log(`📊 Health: http://${config.HOST}:${config.PORT}/health`)
  console.log(`🔌 WebSocket: ws://${config.HOST}:${config.PORT}/ws`)
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
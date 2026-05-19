import pino from 'pino'
import { startServer } from './app.js'
import { getConfig } from './infra/config/config.js'

async function main() {
  const config = getConfig()
  const logger = pino({ level: config.LOG_LEVEL })

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'uncaught.exception')
    process.exit(1)
  })

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandled.rejection')
    process.exit(1)
  })

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...')
    process.exit(0)
  })

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...')
    process.exit(0)
  })

  const { app, logger: serverLogger } = await startServer()
  serverLogger.info(`🚀 Server running on http://${config.HOST}:${config.PORT}`)
  serverLogger.info(`📊 Health: http://${config.HOST}:${config.PORT}/health`)
  serverLogger.info(`🔌 WebSocket: ws://${config.HOST}:${config.PORT}/ws`)
}

main().catch((err) => {
  pino().error({ err }, 'Failed to start server')
  process.exit(1)
})
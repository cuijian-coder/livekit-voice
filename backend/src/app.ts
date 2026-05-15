import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import cors from '@fastify/cors'
import { GatewayServer } from './gateway/websocket/server.js'
import { SessionManager } from './runtime/voice-session/session-manager.js'
import { getConfig } from './infra/config/config.js'
import pino from 'pino'

export function buildApp() {
  const config = getConfig()
  const logger = pino({
    level: config.LOG_LEVEL,
    transport: config.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: { colorize: true },
    } : undefined,
  })

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
    },
  })
  const sessionManager = new SessionManager(logger)
  const gateway = new GatewayServer(sessionManager, logger)

  app.register(cors, { origin: true })
  app.register(websocket)

  app.get('/health', async () => ({ status: 'ok', sessions: sessionManager.size }))

  app.get('/ws', { websocket: true }, (socket: any) => {
    gateway.handleConnection(socket as any)
  })

  return { app, sessionManager, gateway, logger }
}

export async function startServer() {
  const config = getConfig()
  const { app, logger } = buildApp()

  try {
    await app.listen({ port: config.PORT, host: config.HOST })
    logger.info({ port: config.PORT, host: config.HOST }, 'server.started')
    return app
  } catch (err) {
    logger.error({ err }, 'server.start.failed')
    throw err
  }
}
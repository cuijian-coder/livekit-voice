import Fastify from 'fastify'
import { WebSocketServer, WebSocket } from 'ws'
import cors from '@fastify/cors'
import { GatewayServer } from './gateway/websocket/server.js'
import { SessionManager } from './runtime/voice-session/session-manager.js'
import { registerDebugEndpoint } from './gateway/debug-endpoint.js'
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

  app.get('/health', async () => ({ status: 'ok', sessions: sessionManager.size }))

  registerDebugEndpoint(app, sessionManager.diagnostics)

  return { app, sessionManager, gateway, logger, config }
}

export async function startServer() {
  const { app, logger, config, gateway } = buildApp()

  const wss = new WebSocketServer({ noServer: true })

  app.server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        logger.debug({ pathname }, 'ws.upgrade.accepted')
        gateway.handleConnection(ws)
      })
    } else {
      socket.destroy()
    }
  })

  await app.listen({ port: config.PORT, host: config.HOST })

  logger.info({ port: config.PORT, host: config.HOST }, 'server.started')
  return { app, logger }
}
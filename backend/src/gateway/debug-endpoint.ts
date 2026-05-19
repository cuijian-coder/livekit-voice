import type { FastifyInstance } from 'fastify'
import type { DiagnosticsCollector } from '../runtime/diagnostics-collector'

export function registerDebugEndpoint(
  app: FastifyInstance,
  collector: DiagnosticsCollector
): void {
  app.get('/debug/runtime', async (req, reply) => {
    try {
      const snapshot = collector.snapshot()
      return reply.header('Content-Type', 'application/json').send(JSON.stringify(snapshot))
    } catch (err) {
      req.log.error({ err }, 'debug.endpoint.error')
      return reply.status(500).send({ error: 'Failed to get diagnostics' })
    }
  })
}
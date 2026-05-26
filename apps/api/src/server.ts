import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

import { env } from './env.js';
import { buildLoggerOptions } from './logger.js';
import { createQueueRegistry, type QueueRegistry } from './queues/registry.js';
import { bullBoardRoute } from './routes/admin.js';
import { healthRoutes } from './routes/health.js';
import { queueRoutes } from './routes/queues.js';
import { scanRoutes } from './routes/scans.js';

export type BuildServerOptions = {
  /** Override logger config. Tests pass `false` to silence output. */
  logger?: ReturnType<typeof buildLoggerOptions>;
  queues?: QueueRegistry;
};

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? buildLoggerOptions(env.NODE_ENV),
  });

  const queues = options.queues ?? createQueueRegistry();

  await app.register(helmet, {
    // Bull Board ships its own assets; Helmet's default CSP refuses them.
    contentSecurityPolicy: false,
  });
  await app.register(cors, {
    origin: env.WEB_APP_URL,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    // Health probes shouldn't get rate-limited or they'll fail liveness checks.
    allowList: (req) => req.url === '/health' || req.url === '/ready',
  });

  app.addHook('onClose', async () => {
    await queues.close();
  });

  await app.register(healthRoutes, { queues });
  await app.register(queueRoutes, { queues, prefix: '/v1' });
  await app.register(scanRoutes, { queues, prefix: '/v1' });
  await app.register(bullBoardRoute, { queues });

  return app;
}

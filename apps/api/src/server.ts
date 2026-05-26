import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';

import { env } from './env.js';
import { createQueueRegistry, type QueueRegistry } from './queues/registry.js';
import { healthRoutes } from './routes/health.js';
import { queueRoutes } from './routes/queues.js';

export type BuildServerOptions = {
  logger?: boolean;
  queues?: QueueRegistry;
};

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? env.NODE_ENV !== 'test',
  });

  const queues = options.queues ?? createQueueRegistry();

  await app.register(helmet);
  await app.register(cors, {
    origin: env.WEB_APP_URL,
    credentials: true,
  });

  app.addHook('onClose', async () => {
    await queues.close();
  });

  await app.register(healthRoutes, { queues });
  await app.register(queueRoutes, { queues, prefix: '/v1' });

  return app;
}

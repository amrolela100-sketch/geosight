import type { FastifyPluginAsync } from 'fastify';

import { env } from '../env.js';
import type { QueueRegistry } from '../queues/registry.js';

type HealthRoutesOptions = {
  queues: QueueRegistry;
};

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, options) => {
  app.get('/health', async () => ({
    ok: true,
    service: '@geosight/api',
    environment: env.NODE_ENV,
    queues: {
      enabled: options.queues.enabled,
      names: options.queues.names,
    },
  }));

  app.get('/ready', async (_req, reply) => {
    if (!options.queues.enabled) {
      return reply.code(503).send({
        ok: false,
        reason: 'REDIS_URL_NOT_CONFIGURED',
      });
    }

    return {
      ok: true,
    };
  });
};

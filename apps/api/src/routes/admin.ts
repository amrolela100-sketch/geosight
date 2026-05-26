import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../env.js';
import type { QueueRegistry } from '../queues/registry.js';

type AdminBullBoardOptions = {
  queues: QueueRegistry;
};

/** Mounts the Bull Board UI at /admin/queues, but only when REDIS_URL is
 * actually configured (otherwise the board has nothing to render) AND
 * ADMIN_API_TOKEN is set (so we don't expose queue state by default).
 *
 * Auth is a simple shared-secret header `X-Admin-Token`. This is good enough
 * for solo-developer ops until Phase 3 wires Clerk-issued admin JWTs.
 */
export const bullBoardRoute: FastifyPluginAsync<AdminBullBoardOptions> = async (app, options) => {
  if (!options.queues.enabled || !env.ADMIN_API_TOKEN) {
    app.log.info(
      { reason: !options.queues.enabled ? 'queues-disabled' : 'no-admin-token' },
      'bull-board: skipping mount',
    );
    return;
  }

  const bullAdapters = options.queues.names
    .map((name) => options.queues.get(name))
    .filter((q): q is NonNullable<typeof q> => q !== null)
    .map((q) => new BullMQAdapter(q));

  const serverAdapter = new FastifyAdapter();
  createBullBoard({
    queues: bullAdapters,
    serverAdapter,
  });
  serverAdapter.setBasePath('/admin/queues');

  // Gate the entire surface with a token check before the UI handler runs.
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/admin/queues')) return;
    const provided = req.headers['x-admin-token'];
    if (provided !== env.ADMIN_API_TOKEN) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  await app.register(serverAdapter.registerPlugin(), {
    prefix: '/admin/queues',
  });

  app.log.info({ queueCount: bullAdapters.length }, 'bull-board: mounted at /admin/queues');
};

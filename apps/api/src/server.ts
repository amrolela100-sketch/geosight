import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

import { env } from './env.js';
import { buildLoggerOptions } from './logger.js';
import {
  startDailyMetricsWorker,
  type DailyMetricsWorkerHandle,
} from './metrics/daily-worker.js';
import { ensureDailyMetricsSchedule } from './metrics/scheduler.js';
import { createQueueRegistry, type QueueRegistry } from './queues/registry.js';
import { bullBoardRoute } from './routes/admin.js';
import { healthRoutes } from './routes/health.js';
import { metricsRoutes } from './routes/metrics.js';
import { queueRoutes } from './routes/queues.js';
import { scanRoutes } from './routes/scans.js';
import { vaultRoutes } from './routes/vault.js';
import { ensureVaultValidationSchedule } from './vault/scheduler.js';
import {
  startVaultValidationWorker,
  type VaultValidationWorkerHandle,
} from './vault/worker.js';

export type BuildServerOptions = {
  /** Override logger config. Tests pass `false` to silence output. */
  logger?: ReturnType<typeof buildLoggerOptions>;
  queues?: QueueRegistry;
  metrics?: Parameters<typeof metricsRoutes>[1];
  startMetricsWorker?: boolean;
  metricsWorker?: DailyMetricsWorkerHandle | null;
  startVaultValidationWorker?: boolean;
  vaultValidationWorker?: VaultValidationWorkerHandle | null;
};

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? buildLoggerOptions(env.NODE_ENV),
  });

  const queues = options.queues ?? createQueueRegistry();
  const metricsWorker =
    options.metricsWorker ??
    (options.startMetricsWorker === false
      ? null
      : startDailyMetricsWorker({
          logger: app.log,
        }));
  const vaultValidationWorker =
    options.vaultValidationWorker ??
    (options.startVaultValidationWorker === false
      ? null
      : startVaultValidationWorker({
          queues,
          logger: app.log,
        }));

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
    await metricsWorker?.close();
    await vaultValidationWorker?.close();
    await queues.close();
  });

  await app.register(healthRoutes, { queues });
  await app.register(queueRoutes, { queues, prefix: '/v1' });
  await app.register(scanRoutes, { queues, prefix: '/v1' });
  await app.register(metricsRoutes, { ...options.metrics, prefix: '/v1' });
  await app.register(vaultRoutes, { queues, prefix: '/v1' });
  await app.register(bullBoardRoute, { queues });

  const schedule = await ensureDailyMetricsSchedule(queues);
  if (schedule.scheduled) {
    app.log.info(schedule, 'metrics-scheduler: daily aggregation scheduled');
  } else {
    app.log.info(schedule, 'metrics-scheduler: skipping schedule');
  }

  const vaultSchedule = await ensureVaultValidationSchedule(queues);
  if (vaultSchedule.scheduled) {
    app.log.info(vaultSchedule, 'vault-scheduler: daily key validation scheduled');
  } else {
    app.log.info(vaultSchedule, 'vault-scheduler: skipping schedule');
  }

  return app;
}

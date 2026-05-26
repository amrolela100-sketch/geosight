import {
  aggregateDailyMetrics,
  createDatabase,
  deleteExpiredScanResults,
  type Database,
  type SqlClient,
} from '@geosight/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { env } from '../env.js';

type MetricsRoutesOptions = {
  db?: Database;
  sql?: SqlClient;
};

const runDailyMetricsSchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  retentionDays: z.number().int().positive().max(365).default(90),
  applyRetention: z.boolean().default(true),
});

function requireAdminToken(headers: Record<string, string | string[] | undefined>): boolean {
  if (!env.ADMIN_API_TOKEN) return false;
  return headers['x-admin-token'] === env.ADMIN_API_TOKEN;
}

export const metricsRoutes: FastifyPluginAsync<MetricsRoutesOptions> = async (app, options) => {
  app.post('/admin/metrics/daily/run', async (request, reply) => {
    if (!requireAdminToken(request.headers)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (!options.db && !env.DATABASE_URL) {
      return reply.code(503).send({ error: 'DatabaseUnavailable' });
    }

    const parsed = runDailyMetricsSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'InvalidPayload',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    const owned = options.db
      ? null
      : createDatabase({
          url: env.DATABASE_URL!,
          max: 2,
        });
    const db = options.db ?? owned!.db;

    try {
      const aggregation = await aggregateDailyMetrics({
        db,
        day: parsed.data.day ? new Date(`${parsed.data.day}T00:00:00.000Z`) : undefined,
      });
      const retention = parsed.data.applyRetention
        ? await deleteExpiredScanResults({
            db,
            retentionDays: parsed.data.retentionDays,
          })
        : null;

      return reply.send({
        ok: true,
        aggregation,
        retention: retention
          ? {
              deletedRows: retention.deletedRows,
              cutoff: retention.cutoff.toISOString(),
            }
          : null,
      });
    } finally {
      if (owned) await owned.sql.end({ timeout: 5 });
    }
  });
};

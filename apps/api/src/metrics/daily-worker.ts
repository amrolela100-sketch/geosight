import {
  aggregateDailyMetrics,
  createDatabase,
  deleteExpiredScanResults,
  type Database,
  type SqlClient,
} from '@geosight/db';
import { Worker, type Job, type WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';

import { env } from '../env.js';
import { dailyMetricsJobSchema, type DailyMetricsJobPayload } from '../queues/payloads.js';

export type DailyMetricsWorkerHandle = {
  close(): Promise<void>;
};

export type StartDailyMetricsWorkerOptions = {
  redisUrl?: string;
  databaseUrl?: string;
  db?: Database;
  sql?: SqlClient;
  workerOptions?: Partial<WorkerOptions>;
  logger?: {
    info(obj: Record<string, unknown>, msg?: string): void;
    error(obj: Record<string, unknown>, msg?: string): void;
  };
};

export async function runDailyMetricsJob(
  payload: DailyMetricsJobPayload,
  options: { db: Database },
): Promise<{
  aggregation: Awaited<ReturnType<typeof aggregateDailyMetrics>>;
  retention: { deletedRows: number; cutoff: string } | null;
}> {
  const parsed = dailyMetricsJobSchema.parse(payload);
  const aggregation = await aggregateDailyMetrics({
    db: options.db,
    day: parsed.day ? new Date(`${parsed.day}T00:00:00.000Z`) : undefined,
  });
  const retention = parsed.applyRetention
    ? await deleteExpiredScanResults({
        db: options.db,
        retentionDays: parsed.retentionDays,
      })
    : null;

  return {
    aggregation,
    retention: retention
      ? {
          deletedRows: retention.deletedRows,
          cutoff: retention.cutoff.toISOString(),
        }
      : null,
  };
}

export function startDailyMetricsWorker(
  options: StartDailyMetricsWorkerOptions = {},
): DailyMetricsWorkerHandle | null {
  const redisUrl = options.redisUrl ?? env.REDIS_URL;
  const databaseUrl = options.databaseUrl ?? env.DATABASE_URL;
  if (!redisUrl || (!databaseUrl && !options.db)) {
    options.logger?.info(
      { reason: !redisUrl ? 'redis-disabled' : 'database-disabled' },
      'metrics-worker: skipping start',
    );
    return null;
  }

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  const ownedDb = options.db
    ? null
    : createDatabase({
        url: databaseUrl!,
        max: 2,
      });
  const db = options.db ?? ownedDb!.db;

  const worker = new Worker(
    'metrics:daily',
    async (job: Job<DailyMetricsJobPayload>) => {
      const result = await runDailyMetricsJob(job.data, { db });
      options.logger?.info(
        {
          jobId: job.id,
          metricDate: result.aggregation.metricDate,
          brandsAggregated: result.aggregation.brandsAggregated,
          scansAggregated: result.aggregation.scansAggregated,
          deletedRows: result.retention?.deletedRows ?? 0,
        },
        'metrics-worker: completed daily aggregation',
      );
      return result;
    },
    {
      connection,
      concurrency: 1,
      ...options.workerOptions,
    },
  );

  worker.on('failed', (job, error) => {
    options.logger?.error(
      {
        jobId: job?.id,
        error,
      },
      'metrics-worker: job failed',
    );
  });

  return {
    async close() {
      await worker.close();
      connection.disconnect();
      if (ownedDb) await ownedDb.sql.end({ timeout: 5 });
    },
  };
}

import { createDatabase, type Database, type SqlClient } from '@geosight/db';
import { Worker, type Job, type WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';

import { env } from '../env.js';
import { vaultValidationJobSchema, type VaultValidationJobPayload } from '../queues/payloads.js';
import type { QueueRegistry } from '../queues/registry.js';

import { runVaultValidationJob } from './validation.js';

export type VaultValidationWorkerHandle = {
  close(): Promise<void>;
};

export type StartVaultValidationWorkerOptions = {
  redisUrl?: string;
  databaseUrl?: string;
  db?: Database;
  sql?: SqlClient;
  queues?: QueueRegistry;
  workerOptions?: Partial<WorkerOptions>;
  logger?: {
    info(obj: Record<string, unknown>, msg?: string): void;
    error(obj: Record<string, unknown>, msg?: string): void;
  };
};

export function startVaultValidationWorker(
  options: StartVaultValidationWorkerOptions = {},
): VaultValidationWorkerHandle | null {
  const redisUrl = options.redisUrl ?? env.REDIS_URL;
  const databaseUrl = options.databaseUrl ?? env.DATABASE_URL;
  if (!redisUrl || (!databaseUrl && !options.db)) {
    options.logger?.info(
      { reason: !redisUrl ? 'redis-disabled' : 'database-disabled' },
      'vault-worker: skipping start',
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
    'vault:validate',
    async (job: Job<VaultValidationJobPayload>) => {
      const payload = vaultValidationJobSchema.parse(job.data);
      const result = await runVaultValidationJob({
        db,
        masterKey: env.KEY_VAULT_MASTER_KEY,
        orgId: payload.organizationId,
        enqueueAlerts: payload.enqueueAlerts,
        alertQueue: options.queues?.get('alert:send') ?? null,
        userAgent: 'vault-validation-worker',
      });
      options.logger?.info(
        {
          jobId: job.id,
          checked: result.checked,
          invalid: result.invalid,
          alertsQueued: result.alertsQueued,
        },
        'vault-worker: completed key validation',
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
      'vault-worker: job failed',
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

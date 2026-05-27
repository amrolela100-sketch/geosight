import type { JobsOptions, Queue } from 'bullmq';

import type { QueueRegistry } from '../queues/registry.js';

const VAULT_VALIDATION_JOB_ID = 'vault:validate:daily:utc-03';
const VAULT_VALIDATION_CRON = '0 3 * * *';

export async function ensureVaultValidationSchedule(
  queues: QueueRegistry,
  options: {
    queue?: Queue | null;
    enqueueAlerts?: boolean;
  } = {},
): Promise<{ scheduled: boolean; jobId?: string; pattern?: string; reason?: string }> {
  if (!queues.enabled) return { scheduled: false, reason: 'queues-disabled' };

  const queue = options.queue ?? queues.get('vault:validate');
  if (!queue) return { scheduled: false, reason: 'queue-missing' };

  const repeat: JobsOptions['repeat'] = {
    pattern: VAULT_VALIDATION_CRON,
    tz: 'UTC',
  };

  await queue.add(
    'vault:validate',
    {
      enqueueAlerts: options.enqueueAlerts ?? true,
      requestedAt: new Date().toISOString(),
    },
    {
      jobId: VAULT_VALIDATION_JOB_ID,
      repeat,
    },
  );

  return {
    scheduled: true,
    jobId: VAULT_VALIDATION_JOB_ID,
    pattern: VAULT_VALIDATION_CRON,
  };
}
